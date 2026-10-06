# Regional Maps

The catalog contains 11 regional and five historical theaters in one gallery. There is no category switcher. All maps use standard recruitment and conquest rules, with 24–30 regions each.

| Map | Regions | Preset ID |
|---|---:|---|
| Mediterranean | 24 | `mediterranean` |
| Europe | 28 | `europe` |
| The Americas | 28 | `americas` |
| Africa & Middle East | 28 | `africa_middle_east` |
| Central Asia | 30 | `central_asia` |
| Afghanistan, Balochistan & Indus | 30 | `balochistan_borderlands_expanded` |
| Indian Subcontinent | 30 | `india` |
| Southeast Asia & Oceania | 28 | `southeast_asia_oceania` |
| Northeast Asia | 30 | `japan_korea` |
| British & Irish Isles | 24 | `british_irish_isles` |
| Anatolia & the Caucasus | 24 | `anatolia_caucasus` |

The retained theaters keep their current geometry, route graphs, terrain rules and starts, except for the expanded Northeast Asia map. Northeast Asia has 30 regions across Japan, Korea, the three northeastern Chinese provinces and the Pacific-facing Russian Far East, including Amur, Primorye, Khabarovsk, Magadan, Sakhalin, the Kurils and Kamchatka. Its internal ID remains `japan_korea`; new games use `japan_korea_atlas_v6`. Older Japan & Korea assets remain for save compatibility. The Caribbean and Andes theaters are retired. The three additional regional specifications live in `collection_sources.py`; the original eight are Python definitions in `engine/presets/`. `compact.json`, `expansion.json`, `reviewed.json` and `polished.json` are successive build stages containing the active theater definitions.

Historical Battles, Historical Campaigns, Cities & Sieges, and Epics have been removed, including their versioned assets and source datasets. Their IDs are rejected for new games; existing saves show a retired-map error and their downloaded files cannot be restored. Older **regional** assets are retained for existing saves, including the regional maps retired during earlier catalog revisions.

Regional generation uses local Natural Earth province and river archives. No GIS dependencies or third-party map requests are needed at runtime.

```sh
python -m games.borderstrife.tools.build_collections /path/to/provinces.zip /path/to/rivers.zip
python -m games.borderstrife.tools.build_reviewed_maps /path/to/provinces.zip
python -m games.borderstrife.tools.build_polished_maps /path/to/provinces.zip
python -m games.borderstrife.tools.build_thumbnails
```

Publish a new immutable map asset version if changing geography or rules used by saved campaigns.

## Historical theaters

Five campaign-scale maps now accompany the 11 regional maps in the same gallery:
Crusader Levant (1187, 28 regions), Civil War Eastern Theater (28), Greece, Persia & Egypt
(ancient-war composite, 30), Viking World · Northern Europe (composite, 30), and Norman England (1066, 28).

`historical_sources.py` specifies scope, dated place anchors, terrain types,
research references and explicit sea crossings. Historical sectors grow on the
coastline-clipped land around those anchors; modern internal province boundaries
are dissolved. England's modern outer outline defines the Norman theater and is
not asserted to be an exact medieval frontier. Relief symbols and supplemental
rivers are illustrative, using the same presentation as regional theaters.

These are open-ended conquest maps with balanced recommended starts, not military
simulations or historical orders of battle. Composite maps do not imply all named
places belonged to one polity at one time. No naval, siege or faction rules change.

Rebuild one theater with the existing map-build environment:

```sh
python -m games.borderstrife.tools.build_collections /path/to/provinces.zip /path/to/rivers.zip crusader_levant
python -m games.borderstrife.tools.build_reviewed_maps /path/to/provinces.zip crusader_levant
python -m games.borderstrife.tools.build_polished_maps /path/to/provinces.zip crusader_levant
python -m games.borderstrife.tools.build_thumbnails
```

Use new asset versions when changing any map after release; saves retain their
original geometry. The six new IDs intentionally do not reuse retired maps.

Nile Valley & the Horn and Napoleon (1805) are retired from selection and build specifications. Their versioned map assets remain available for existing games and downloaded saves.

Viking World uses `viking_conquests_atlas_v6` with 30 regions across Nordic homelands, the North Atlantic, northern Francia and Baltic/Rus approaches. The previous 28-region Britain/Ireland assets remain immutable for saves. Authored sea links keep crossings explicit; shared land borders remain traversable. Modern administrative outlines restrict the outer theater in Francia, Germany and northwestern Russia; internal sectors are gameplay interpretations.

Greece, Persia & Egypt uses `greco_persian_atlas_v6`, spanning Greece, Anatolia, Cyprus, the Levant, Mesopotamia, Egypt and the Iranian plateau. Its 30 larger sectors replace the tightly packed Aegean map for new games. Earlier Aegean assets remain available for saved games. This 499–330 BC composite uses modern coastline data, interpreted historic place anchors, illustrative terrain and balanced conquest starts; it is not a political snapshot or the full extent of the Achaemenid Empire.
