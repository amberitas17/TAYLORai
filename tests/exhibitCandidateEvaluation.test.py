import json
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from evaluate_exhibit_candidate import evaluate


class ExhibitCandidateEvaluationTest(unittest.TestCase):
    classes = ["A", "B"]

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.test_dir = self.root / "held-out"
        for label, value in (("A", 0), ("B", 255)):
            target = self.test_dir / label
            target.mkdir(parents=True)
            for index in range(2):
                Image.new("RGB", (32, 24), (value, value, value)).save(target / f"{index}.png")
        self.production_model = self.root / "production.onnx"
        self.candidate_model = self.root / "candidate.onnx"
        self.regression_model = self.root / "regression.onnx"
        self.write_model(self.production_model, mode="color")
        self.write_model(self.candidate_model, mode="color")
        self.write_model(self.regression_model, mode="always_b")
        self.production_metadata = self.root / "production.json"
        self.candidate_metadata = self.root / "candidate.json"
        self.write_metadata(self.production_metadata, self.classes)
        self.write_metadata(self.candidate_metadata, self.classes)

    def tearDown(self):
        self.temp.cleanup()

    def write_metadata(self, path, classes):
        path.write_text(json.dumps({
            "classes": classes,
            "input_shape": [1, 3, 224, 224],
            "output_shape": [1, 2],
            "output_type": "logits",
            "preprocessing": {"mean": [0, 0, 0], "std": [1, 1, 1]},
        }))

    def write_model(self, path, mode):
        input_name = "input"
        output_name = "output"
        input_tensor = helper.make_tensor_value_info(input_name, TensorProto.FLOAT, [1, 3, 224, 224])
        output_tensor = helper.make_tensor_value_info(output_name, TensorProto.FLOAT, [1, 2])
        if mode == "color":
            size = 3 * 224 * 224
            weights = np.zeros((size, 2), dtype=np.float32)
            weights[:, 0] = -10 / size
            weights[:, 1] = 10 / size
            bias = np.array([5, -5], dtype=np.float32)
            nodes = [helper.make_node("Flatten", [input_name], ["flat"]), helper.make_node("Gemm", ["flat", "weights", "bias"], [output_name])]
            initializers = [numpy_helper.from_array(weights, "weights"), numpy_helper.from_array(bias, "bias")]
        else:
            values = np.array([[-5, 5]], dtype=np.float32)
            nodes = [helper.make_node("Constant", [], [output_name], value=numpy_helper.from_array(values))]
            initializers = []
        graph = helper.make_graph(nodes, "fixture", [input_tensor], [output_tensor], initializers)
        model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)])
        model.ir_version = 8
        onnx.checker.check_model(model)
        onnx.save(model, path)

    def args(self, candidate_model=None, candidate_metadata=None, test_dir=None):
        return Namespace(
            production_model=self.production_model,
            production_metadata=self.production_metadata,
            candidate_model=candidate_model or self.candidate_model,
            candidate_metadata=candidate_metadata or self.candidate_metadata,
            test_dir=test_dir or self.test_dir,
            minimum_samples_per_class=2,
            max_accuracy_regression=0.02,
            max_recall_regression=0.05,
            max_false_acceptance_regression=0.02,
        )

    def test_successful_evaluation_is_ready_for_review(self):
        result = evaluate(self.args())
        self.assertEqual(result["promotion_decision"], "READY_FOR_REVIEW")
        self.assertTrue(result["quality_gate"]["passed"])
        self.assertEqual(result["candidate"]["confusion_matrix"], [[2, 0], [0, 2]])
        self.assertFalse(result["quality_gate"]["production_model_changed"])

    def test_regression_is_rejected(self):
        result = evaluate(self.args(self.regression_model))
        self.assertEqual(result["promotion_decision"], "REJECTED")
        self.assertIn("accuracy regression exceeds gate", result["quality_gate"]["reasons"])

    def test_incompatible_class_mapping_is_rejected(self):
        incompatible = self.root / "incompatible.json"
        self.write_metadata(incompatible, ["B", "A"])
        result = evaluate(self.args(candidate_metadata=incompatible))
        self.assertEqual(result["promotion_decision"], "REJECTED")
        self.assertIn("candidate class mapping differs from production", result["quality_gate"]["reasons"])

    def test_missing_evaluation_data_is_rejected(self):
        result = evaluate(self.args(test_dir=self.root / "missing"))
        self.assertEqual(result["promotion_decision"], "REJECTED")
        self.assertIn("missing evaluation data", result["quality_gate"]["reasons"])


if __name__ == "__main__":
    unittest.main()