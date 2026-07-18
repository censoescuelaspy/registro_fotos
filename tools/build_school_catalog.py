"""Genera el catalogo publico de la muestra piloto desde la planilla oficial."""

from __future__ import annotations

import json
import hashlib
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (
    ROOT.parent
    / "03_DATOS"
    / "Inventarios_Escuelas"
    / "Muestra_CIALPA_Capital_Central_RUE_2026_2026-07-16.xlsx"
)
OUTPUT = ROOT / "assets" / "data" / "pilot-schools.json"
GAS_OUTPUT = ROOT / "gas" / "SchoolsData.js"
SHEET = "muestra_piloto_def"
EXPECTED_TOTAL = 86
EXPECTED_BY_DEPARTMENT = {"CAPITAL": 15, "CENTRAL": 71}


def clean_text(value: object) -> str:
    return " ".join(str(value or "").strip().split())


def coordinate(value: object, field: str, code: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Coordenada {field} invalida para escuela {code}") from exc
    if field == "latitud" and not -90 <= number <= 90:
        raise ValueError(f"Latitud fuera de rango para escuela {code}")
    if field == "longitud" and not -180 <= number <= 180:
        raise ValueError(f"Longitud fuera de rango para escuela {code}")
    return round(number, 7)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"No se encontro la fuente: {SOURCE}")

    workbook = load_workbook(SOURCE, read_only=True, data_only=True)
    worksheet = workbook[SHEET]
    rows = worksheet.iter_rows(values_only=True)
    headers = [clean_text(value) for value in next(rows)]
    index = {name: position for position, name in enumerate(headers)}
    required = {
        "ENUMERA",
        "DEPTO",
        "DIST",
        "ZONA",
        "LOCALIDAD",
        "CODIGO",
        "NOMBRE",
        "LAT_DEC",
        "LNG_DEC",
    }
    missing = sorted(required - index.keys())
    if missing:
        raise ValueError(f"Columnas faltantes: {', '.join(missing)}")

    schools: list[dict[str, object]] = []
    seen: set[str] = set()
    for row in rows:
        code = clean_text(row[index["CODIGO"]])
        if not code:
            continue
        if code in seen:
            raise ValueError(f"Codigo duplicado en la muestra: {code}")
        seen.add(code)
        schools.append(
            {
                "codigo": code,
                "nombre": clean_text(row[index["NOMBRE"]]),
                "departamento": clean_text(row[index["DEPTO"]]).upper(),
                "distrito": clean_text(row[index["DIST"]]),
                "zona": clean_text(row[index["ZONA"]]).upper(),
                "localidad": clean_text(row[index["LOCALIDAD"]]),
                "latitud": coordinate(row[index["LAT_DEC"]], "latitud", code),
                "longitud": coordinate(row[index["LNG_DEC"]], "longitud", code),
                "ordenMuestra": int(row[index["ENUMERA"]]),
            }
        )

    schools.sort(key=lambda school: int(school["ordenMuestra"]))
    by_department = Counter(str(school["departamento"]) for school in schools)
    if len(schools) != EXPECTED_TOTAL:
        raise ValueError(f"Se esperaban {EXPECTED_TOTAL} escuelas y se obtuvieron {len(schools)}")
    if dict(by_department) != EXPECTED_BY_DEPARTMENT:
        raise ValueError(
            f"Distribucion inesperada: {dict(by_department)}; esperada: {EXPECTED_BY_DEPARTMENT}"
        )

    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": SOURCE.name,
        "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "scope": "Muestra piloto Capital y Central",
        "total": len(schools),
        "byDepartment": dict(by_department),
        "schools": schools,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    GAS_OUTPUT.write_text(
        "// Generado por tools/build_school_catalog.py. No editar manualmente.\n"
        "const PILOT_SCHOOLS = "
        + json.dumps(schools, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Catalogo generado: {OUTPUT} ({len(schools)} escuelas)")
    print(f"Catalogo GAS generado: {GAS_OUTPUT}")


if __name__ == "__main__":
    main()
