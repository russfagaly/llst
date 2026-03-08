import cv2
import pytesseract
from PIL import Image
from img2table.document import Image as Img2TableImage
from img2table.ocr import TesseractOCR
import pandas as pd
from typing import List, Dict, Tuple
import numpy as np

class OCRProcessor:
    """Handles OCR processing and table extraction from images"""

    def __init__(self):
        self.ocr = TesseractOCR(lang="eng")

    def extract_tables_from_image(self, image_path: str) -> List[Dict]:
        """
        Extract tables from an image using img2table

        Returns:
            List of dictionaries containing table data and metadata
        """
        try:
            # Load image with img2table
            doc = Img2TableImage(src=image_path)

            # Extract tables
            extracted_tables = doc.extract_tables(
                ocr=self.ocr,
                implicit_rows=True,
                borderless_tables=True,
                min_confidence=50
            )

            results = []

            for table_idx, table in enumerate(extracted_tables):
                # Convert table to DataFrame
                df = table.df

                if df is None or df.empty:
                    continue

                # Get table dimensions
                rows, cols = df.shape

                # Extract cell data with positions
                cells = []
                for row_idx in range(rows):
                    for col_idx in range(cols):
                        content = str(df.iloc[row_idx, col_idx])
                        if pd.isna(df.iloc[row_idx, col_idx]):
                            content = ""

                        cells.append({
                            "row_index": row_idx,
                            "column_index": col_idx,
                            "content": content,
                            "confidence": 0.85  # img2table doesn't provide per-cell confidence
                        })

                # Calculate overall confidence
                bbox = table.bbox
                confidence = self._calculate_table_confidence(image_path, bbox)

                results.append({
                    "table_number": table_idx,
                    "rows": rows,
                    "columns": cols,
                    "cells": cells,
                    "confidence": confidence
                })

            return results

        except Exception as e:
            print(f"Error extracting tables: {e}")
            return []

    def _calculate_table_confidence(self, image_path: str, bbox: Tuple) -> float:
        """
        Calculate OCR confidence for a table region

        Args:
            image_path: Path to the image
            bbox: Bounding box (x1, y1, x2, y2)

        Returns:
            Confidence score between 0 and 1
        """
        try:
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                return 0.5

            # Extract region if bbox is provided
            if bbox:
                x1, y1, x2, y2 = bbox
                region = image[y1:y2, x1:x2]
            else:
                region = image

            # Convert to PIL Image
            pil_image = Image.fromarray(cv2.cvtColor(region, cv2.COLOR_BGR2RGB))

            # Get OCR data with confidence
            ocr_data = pytesseract.image_to_data(pil_image, output_type=pytesseract.Output.DICT)

            # Calculate average confidence
            confidences = [int(conf) for conf in ocr_data['conf'] if int(conf) > 0]

            if confidences:
                avg_confidence = sum(confidences) / len(confidences) / 100.0
                return round(avg_confidence, 2)

            return 0.5

        except Exception as e:
            print(f"Error calculating confidence: {e}")
            return 0.5

    def preprocess_image(self, image_path: str, output_path: str = None) -> str:
        """
        Preprocess image for better OCR results

        Args:
            image_path: Input image path
            output_path: Optional output path for preprocessed image

        Returns:
            Path to preprocessed image
        """
        # Load image
        image = cv2.imread(image_path)

        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Apply thresholding
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Denoise
        denoised = cv2.fastNlMeansDenoising(thresh, None, 10, 7, 21)

        # Save preprocessed image
        if output_path is None:
            output_path = image_path.replace('.', '_preprocessed.')

        cv2.imwrite(output_path, denoised)

        return output_path
