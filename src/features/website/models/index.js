// file location: src/features/website/models/index.js
// Catalog of every Suzuki glTF model used by the public customer website
// /website page. Add or remove a car here and Website3DScene picks up
// the change without further edits.
//
// Storage convention: Next.js only exposes binary assets to the
// browser when they live under /public, so the actual .gltf, .bin
// and texture files sit at /public/models/<slug>/. This file is the
// source-of-truth catalog those URLs map to, kept inside the
// customer website feature folder so the model list lives next to the
// code that consumes it.
//
// Optional fields:
//   orientationFix   — extra Y-axis rotation (radians) applied before
//                      the per-section rotY. Use Math.PI to flip a car
//                      that exports facing backwards. `null` lets
//                      Website3DScene auto-detect from the bounding box
//                      (long axis along X gets a 90° fix so the body
//                      runs front-to-back like the others).

export const carModels = [
  {
    slug: "swift",
    label: "Suzuki Swift",
    url: "/models/swift/scene.gltf",
    orientationFix: null,
  },
  {
    slug: "vitara",
    label: "Suzuki Vitara",
    url: "/models/vitara/scene.gltf",
    orientationFix: null,
  },
  {
    slug: "s-cross",
    label: "Suzuki S-Cross",
    url: "/models/s-cross/scene.gltf",
    orientationFix: null,
  },
  {
    slug: "a-cross",
    label: "Suzuki Across",
    url: "/models/a-cross/scene.gltf",
    orientationFix: null,
  },
];

export default carModels;
