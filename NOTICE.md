# Data source attribution

Kolo stores food composition data from the sources below. Records are kept
strictly isolated per source — never merged or cross-filled — so each
dataset's license applies only to its own rows. The same attribution texts
are returned verbatim by the MCP food tools (`search_foods`, `get_food`).

## USDA FoodData Central

U.S. Department of Agriculture (USDA), Agricultural Research Service.
FoodData Central. <https://fdc.nal.usda.gov>.

Public domain (CC0 1.0). The imported release version is recorded per
import run in the `import_run` table.

## Open Food Facts

Data from Open Food Facts (<https://world.openfoodfacts.org>),
© Open Food Facts contributors, licensed under the
[Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/).

Kolo caches individual barcode lookups from the Open Food Facts API
(`dataType='off_api'`). These rows form a database derived from Open Food
Facts and remain available under the ODbL; they are never mixed into other
sources' rows.

## China Food Composition Tables（中国食物成分表）

No data from this work is bundled with, or distributed by, this project.
Operators may import their own legally obtained copy through the CSV
template (`docs/cfct-template.csv`); such rows are marked
`redistributable=false` and are excluded from any export or dump
functionality. 第三方整理数据仅限操作者本地自用，请自行核对版权边界。

## User-created foods

Foods created through the `create_food` MCP tool belong to the creating
user and are visible only to them.
