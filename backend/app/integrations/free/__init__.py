"""Free / zero-cost data providers used as alternatives to DataForSEO.

Each module returns a `DfsResult` (with `cost_cents=0`) whose `result` is shaped
to match the corresponding DataForSEO parser, so the existing route parsers and
the cost engine work unchanged.
"""
