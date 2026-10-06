# Regional map review

The active catalog is the 12 maps listed in [COLLECTIONS.md](COLLECTIONS.md). Current atlas_v4 assets retain the reviewed geographic borders, shared-border travel, connected starting kingdoms, protected Kashmir outline and borderlands coverage. The category reduction does not regenerate or change those maps.

Validation covers valid region polygons, markers inside their territories, connected starting kingdoms, symmetric travel routes, every shared border, at most seven neighbors per region, and old regional saves/replay geometry. Retired non-regional scenarios and their source-specific checks were removed together with their maps.

Run `python -m games.borderstrife.tools.check_reviewed_maps` and `python -m games.borderstrife.tools.check_compact_borders` for the geographic regressions. `check_reviewed_maps.cjs` exercises every current map in the browser; `check_compact_setup.cjs` checks the single gallery and mobile setup.
