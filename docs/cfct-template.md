# CFCT 导入模板（cfct-template.csv）

`docs/cfct-template.csv` 是《中国食物成分表》（CFCT）数据的录入模板，配套导入命令：

```bash
tsx etl/cfct/index.ts --file <你的csv> [--label "标准版第6版"] [--replace-all] [--force]
```

> **模板自带 2 行示例数据（food_code 000001 / 000002），仅用于演示格式，导入前必须删除。**
> 示例行是完全虚构的，不来自任何真实成分表。

文件为 UTF-8 带 BOM 编码，Excel / WPS / Numbers 可直接打开编辑；保存时请保持 UTF-8 CSV 格式。

## 单元格写法（与原书标注一致）

| 写法 | 含义 | 入库结果 |
| --- | --- | --- |
| 空白 / `—` / `-` | 未检测 | NULL（绝不写 0） |
| `Tr` / `tr` | 微量 | 0，同时列名记入 traceFlags |
| 纯半角数字（如 `12.5`） | 实测值 | 按列名单位入库（per 100g 可食部） |

以下写法会**整文件拒绝导入**（校验错误按 "行号: 列名: 原因" 全部列出）：
行内单位（`12g`）、千分位逗号（`1,234`）、全角数字（`１２`）、负数、非数字文本。

## 必填与校验规则

- `food_code`：必填，必须是 6 位数字，文件内不得重复（作为幂等键 sourceKey）。
- `food_name`：必填（中文名，同时写入 name 与 nameZh）；`food_name_en` 选填。
- `protein_g` / `fat_g` / `carbohydrate_g`：必填。实测为零写 `0`，留空视为未检测并报错。
- `energy_kcal` / `energy_kj`：至少填一列。两列都填时校验 |kj − kcal×4.184|/kj ≤ 5%，
  超出报错；只填一列时另一列自动换算（库中只存 kcal）。
- `edible_pct`：可食部百分比，缺省按 100，范围 (0, 100]。
- `ash_g`（灰分）与 `remark`（备注）不占营养素列：分别存入 food_nutrients.extras
  与 food.sourceMeta。
- 任何一行有错则**整个文件不入库**（all-or-nothing）。

## 版权提示

《中国食物成分表》为版权数据。录入的数据仅限本实例内部使用，不可再分发
（data_source `cfct` 已标记 redistributable=false）。使用
`etl/cfct/from-sanotsu.ts` 从第三方 OCR 仓库转换的数据同样仅限本地自用，
导入前请按类别抽样 5-10% 对照原书校验。
