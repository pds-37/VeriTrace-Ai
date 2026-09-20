"""
Camera-Domain Dataset Audit & Verification Script
Audits genuine sample counts, file integrity, SHA-256 digests, duplicate collisions, and training readiness.

Minimum Target Requirements:
- lateral_flow_cassette: >= 80 genuine images
- non_test_object: >= 80 genuine images
- Total target: >= 160 genuine images
"""

import os
import sys
import json
import hashlib
from typing import Dict, List, Any

def compute_file_sha256(filepath: str) -> str:
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest().lower()

def audit_camera_domain_dataset(base_dir: str) -> Dict[str, Any]:
    manifest_json_path = os.path.join(base_dir, "dataset_manifest.json")
    images_dir = os.path.join(base_dir, "images")
    
    results = {
        "manifest_found": os.path.exists(manifest_json_path),
        "total_manifest_entries": 0,
        "cassette_count": 0,
        "non_test_count": 0,
        "valid_images_found": 0,
        "missing_files": [],
        "hash_mismatches": [],
        "duplicate_hashes": [],
        "schema_errors": [],
        "split_counts": {"train": 0, "val": 0, "test": 0, "unassigned": 0},
        "target_cassette": 80,
        "target_non_test": 80,
        "target_total": 160,
        "is_ready_for_training": False,
    }
    
    if not results["manifest_found"]:
        return results
        
    try:
        with open(manifest_json_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception as e:
        results["schema_errors"].append(f"Failed to parse dataset_manifest.json: {e}")
        return results
        
    images = manifest.get("images", [])
    results["total_manifest_entries"] = len(images)
    
    seen_hashes: Dict[str, str] = {}
    
    for img in images:
        image_id = img.get("image_id", "UNKNOWN")
        label = img.get("label", "")
        recorded_sha256 = (img.get("sha256") or "").lower()
        split = img.get("split", "unassigned")
        
        # Check label
        if label == "lateral_flow_cassette":
            results["cassette_count"] += 1
        elif label == "non_test_object":
            results["non_test_count"] += 1
        else:
            results["schema_errors"].append(f"{image_id}: Invalid label '{label}'")
            
        # Check split
        if split in results["split_counts"]:
            results["split_counts"][split] += 1
        else:
            results["split_counts"]["unassigned"] += 1
            
        # Check duplicate hash
        if recorded_sha256:
            if recorded_sha256 in seen_hashes:
                results["duplicate_hashes"].append({
                    "sha256": recorded_sha256,
                    "image_id_1": seen_hashes[recorded_sha256],
                    "image_id_2": image_id
                })
            else:
                seen_hashes[recorded_sha256] = image_id
                
        # Check file presence if relative path is provided
        img_rel_path = img.get("file_path") or img.get("image_uri")
        if img_rel_path:
            full_path = os.path.join(base_dir, img_rel_path) if not os.path.isabs(img_rel_path) else img_rel_path
            if os.path.exists(full_path):
                results["valid_images_found"] += 1
                actual_sha = compute_file_sha256(full_path)
                if recorded_sha256 and actual_sha != recorded_sha256:
                    results["hash_mismatches"].append({
                        "image_id": image_id,
                        "recorded": recorded_sha256,
                        "actual": actual_sha
                    })
            else:
                results["missing_files"].append(image_id)
                
    # Also inspect physical files in images/ directory
    if os.path.exists(images_dir):
        physical_files = []
        for root, _, files in os.walk(images_dir):
            for file in files:
                if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                    physical_files.append(os.path.join(root, file))
        results["physical_images_on_disk"] = len(physical_files)
    else:
        results["physical_images_on_disk"] = 0
        
    # Check training readiness
    results["is_ready_for_training"] = (
        results["cassette_count"] >= results["target_cassette"] and
        results["non_test_count"] >= results["target_non_test"] and
        len(results["missing_files"]) == 0 and
        len(results["hash_mismatches"]) == 0 and
        len(results["duplicate_hashes"]) == 0
    )
    
    return results

def print_audit_report(results: Dict[str, Any], base_dir: str):
    print("=" * 68)
    print("       CAMERA-DOMAIN DATASET AUDIT & READINESS REPORT")
    print("=" * 68)
    print(f"Dataset Directory:   {os.path.abspath(base_dir)}")
    print(f"Manifest Status:     {'PRESENT' if results['manifest_found'] else 'MISSING'}")
    print("-" * 68)
    print("SAMPLE COUNTS & CLASS DISTRIBUTION:")
    print(f"  • lateral_flow_cassette : {results['cassette_count']:4d} / {results['target_cassette']} target")
    print(f"  • non_test_object       : {results['non_test_count']:4d} / {results['target_non_test']} target")
    print(f"  • Total Genuine Samples : {results['total_manifest_entries']:4d} / {results['target_total']} target")
    print(f"  • Physical Files on Disk: {results.get('physical_images_on_disk', 0):4d}")
    print("-" * 68)
    print("DATA INTEGRITY CHECKS:")
    print(f"  • Duplicate Hashes      : {len(results['duplicate_hashes'])} (Rejections)")
    print(f"  • Missing Files         : {len(results['missing_files'])}")
    print(f"  • SHA-256 Mismatches    : {len(results['hash_mismatches'])}")
    print(f"  • Schema Violations     : {len(results['schema_errors'])}")
    print("-" * 68)
    
    if results["is_ready_for_training"]:
        print("TRAINING READINESS STATUS: [ READY ]")
        print("  ✓ Minimum sample targets achieved (>=80 cassette, >=80 non-test).")
        print("  ✓ Zero duplicate or integrity defects.")
        print("  ✓ Proceed to model training.")
    else:
        rem_cas = max(0, results['target_cassette'] - results['cassette_count'])
        rem_non = max(0, results['target_non_test'] - results['non_test_count'])
        print("TRAINING READINESS STATUS: [ BLOCKED — INSUFFICIENT DATA ]")
        print(f"  ⚠️ Exact Remaining Required Samples:")
        print(f"     - lateral_flow_cassette : {rem_cas} additional genuine images needed")
        print(f"     - non_test_object       : {rem_non} additional genuine images needed")
        print("  ⚠️ Training has been intentionally halted to uphold scientific integrity.")
        print("  ⚠️ No synthetic, AI-generated, or duplicated samples will be used.")
    print("=" * 68)

if __name__ == "__main__":
    base_dir = os.path.join(os.path.dirname(__file__), "..", "field_test_dataset", "camera_domain")
    results = audit_camera_domain_dataset(base_dir)
    print_audit_report(results, base_dir)
