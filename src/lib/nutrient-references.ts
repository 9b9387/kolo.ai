// Official nutrient reference tables, compiled 2026-07-27 from primary
// sources (see each table's source block) with per-value provenance notes.
// Data only — Kolo serves these numbers verbatim; adequacy evaluation is
// the calling agent's job. Regenerate/update by re-running the research
// against the cited standards when they are revised (GB 28050-2025 takes
// effect 2027-03-16 — see caveats).

export type ReferenceKind = 'NRV' | 'RDA' | 'AI';

export interface ReferenceValue {
  nutrient: string;
  unit: string;
  value: number | null;
  kind: ReferenceKind;
  /** Tolerable upper intake level, where one is established. */
  upper_limit?: number;
  note?: string;
}

export interface ReferenceSource {
  name: string;
  citation: string;
  urls: string[];
}

export type DriSex = 'male' | 'female';
export type DriAgeGroup = '19-30' | '31-50' | '51-70' | '71+';

export const CN_NRV: {
  source: ReferenceSource;
  caveats: string[];
  values: ReferenceValue[];
} = {
  "source": {
    "name": "国家卫生健康委员会（原卫生部）— GB 28050-2011《食品安全国家标准 预包装食品营养标签通则》（附录A 现行有效版；GB 28050-2025 已发布未实施，更新值随附）",
    "citation": "GB 28050-2011 附录A 表A.1 营养素参考值（NRV）；含 GB 28050-2025 附录A 更新对照",
    "urls": [
      "https://www.nhc.gov.cn/ewebeditor/uploadfile/2013/06/20130605104041625.pdf",
      "http://law.foodmate.net/show-232570.html",
      "https://www.cnsalt.cn/yyxh/kbcms/ueditor/php/upload/file/20250418/1744955761696300.pdf",
      "http://down.foodmate.net/info/sort/5/33867.html"
    ]
  },
  "caveats": [
    "版本状态：GB 28050-2025 已于2025-03-16发布（代替GB 28050-2011），2027-03-16正式实施，目前（2026-07-27）处于过渡期。截至今日GB 28050-2011仍为强制现行有效版本，故 values 采用2011版NRV；2025版更新值已在相应营养素 note 中标出。过渡期内企业可自愿提前采用2025版。",
    "GB 28050-2025 共调整8项NRV：维生素D 5→10 µg；生物素 30→40 µg；胆碱 450→500 mg；锌 15→11 mg；硒 50→60 µg；碘 150→120 µg；铜 1.5→0.8 mg；并删除胆固醇NRV（原≤300 mg）。其余营养素NRV两版一致。2025版NRV表含能量+31种营养成分（2011版为能量+32种，因删除胆固醇少1项）。",
    "能量口径：NRV能量为8400 kJ，附录A脚注a明确『相当于2000 kcal』；本数据用官方口径2000 kcal，非÷4.184精确换算值（8400÷4.184≈2007.6 kcal）。",
    "维生素A单位口径差异：2011标准为µg RE（视黄醇当量），canonical要求µg RAE，两者对类胡萝卜素的折算不同、并非等值，800 µg RE不能直接当作800 µg RAE使用。",
    "烟酸单位：2011表A.1原文仅标『14 mg』，未标NE（烟酸当量），映射到canonical的mg NE时需知源单位未明确NE。",
    "上限性质营养素：脂肪（≤60 g）、饱和脂肪酸（≤20 g）、胆固醇（≤300 mg）在表A.1中带≤符号，属摄入上限导向；钠（2000 mg）虽表中未标≤但属限制摄入型营养素。",
    "NRV表中存在但canonical键未覆盖、故已忽略的营养素：生物素（2011: 30 µg / 2025: 40 µg）、碘（2011: 150 µg / 2025: 120 µg）、氟（1 mg，两版一致）。2011与2025版NRV表均未收录铬、钼。",
    "Kolo canonical 全部30个键均能在2011版NRV表中找到对应值，无需填null（含manganeseMg=锰3 mg）。糖（sugarsG）不在canonical列表内且NRV表本身也无糖的参考值。",
    "NRV性质：营养素参考值是营养标签专用参考值（成人通用单值，2025版明确适用>36月龄人群），用于标签比较食品营养成分含量水平，并非个体化每日推荐摄入量（DRIs），不等同于个人每日需要量。",
    "数据来源核实：2011版数值直接取自国家卫生健康委官方PDF全文附录A表A.1；2025版更新值取自食品伙伴网标准亮点解读（含新旧NRV对照表）及官方GB 28050-2025解读材料，均确认发布日2025-03-16、实施日2027-03-16。"
  ],
  "values": [
    {
      "nutrient": "energyKcal",
      "unit": "kcal",
      "value": 2000,
      "kind": "NRV",
      "note": "NRV能量=8400 kJ，表A.1脚注a明确『能量相当于2000 kcal』（蛋白质/脂肪/碳水供能比13%/27%/60%），故采用官方口径2000 kcal；若按8400÷4.184精确换算≈2007.6 kcal。2025版能量NRV不变。"
    },
    {
      "nutrient": "proteinG",
      "unit": "g",
      "value": 60,
      "kind": "NRV",
      "note": "2011与2025版一致。"
    },
    {
      "nutrient": "fatG",
      "unit": "g",
      "value": 60,
      "kind": "NRV",
      "note": "上限性质：表A.1标注为『≤60 g』。2011与2025版一致。"
    },
    {
      "nutrient": "satFatG",
      "unit": "g",
      "value": 20,
      "kind": "NRV",
      "note": "上限性质：表A.1标注为『饱和脂肪酸 ≤20 g』。2011与2025版一致。"
    },
    {
      "nutrient": "carbG",
      "unit": "g",
      "value": 300,
      "kind": "NRV",
      "note": "2011与2025版一致。糖（sugars）在两版NRV表中均无NRV值。"
    },
    {
      "nutrient": "fiberG",
      "unit": "g",
      "value": 25,
      "kind": "NRV",
      "note": "2011与2025版一致。"
    },
    {
      "nutrient": "cholesterolMg",
      "unit": "mg",
      "value": 300,
      "kind": "NRV",
      "note": "上限性质：表A.1标注为『≤300 mg』。注意：GB 28050-2025（2027-03-16实施）已删除胆固醇NRV，届时无参考值。"
    },
    {
      "nutrient": "sodiumMg",
      "unit": "mg",
      "value": 2000,
      "kind": "NRV",
      "note": "上限性质（限制摄入型营养素）：钠在表A.1中列为2000 mg但未标≤符号（仅脂肪/饱和脂肪酸/胆固醇标≤）；膳食指导上按上限导向理解。2011与2025版一致。"
    },
    {
      "nutrient": "potassiumMg",
      "unit": "mg",
      "value": 2000,
      "kind": "NRV",
      "note": "2011与2025版一致。"
    },
    {
      "nutrient": "calciumMg",
      "unit": "mg",
      "value": 800,
      "kind": "NRV",
      "note": "2011与2025版一致。"
    },
    {
      "nutrient": "ironMg",
      "unit": "mg",
      "value": 15,
      "kind": "NRV",
      "note": "2011与2025版一致。"
    },
    {
      "nutrient": "magnesiumMg",
      "unit": "mg",
      "value": 300,
      "kind": "NRV",
      "note": "2011与2025版一致。"
    },
    {
      "nutrient": "phosphorusMg",
      "unit": "mg",
      "value": 700,
      "kind": "NRV",
      "note": "2011与2025版一致。"
    },
    {
      "nutrient": "zincMg",
      "unit": "mg",
      "value": 15,
      "kind": "NRV",
      "note": "GB 28050-2025（2027-03-16实施）更新为11 mg。"
    },
    {
      "nutrient": "copperMg",
      "unit": "mg",
      "value": 1.5,
      "kind": "NRV",
      "note": "GB 28050-2025（2027-03-16实施）更新为0.8 mg。"
    },
    {
      "nutrient": "manganeseMg",
      "unit": "mg",
      "value": 3,
      "kind": "NRV",
      "note": "锰在NRV表中值为3 mg。2011与2025版一致。"
    },
    {
      "nutrient": "seleniumUg",
      "unit": "µg",
      "value": 50,
      "kind": "NRV",
      "note": "GB 28050-2025（2027-03-16实施）更新为60 µg。"
    },
    {
      "nutrient": "vitAUgRae",
      "unit": "µg RAE",
      "value": 800,
      "kind": "NRV",
      "note": "单位口径差异：2011表A.1原文为800 µg RE（视黄醇当量），非µg RAE。RE与RAE不等值（对类胡萝卜素折算系数不同），800 µg RE≠800 µg RAE，使用时需注意口径。2011与2025版数值均为800。"
    },
    {
      "nutrient": "vitCMg",
      "unit": "mg",
      "value": 100,
      "kind": "NRV",
      "note": "2011与2025版一致。"
    },
    {
      "nutrient": "vitDUg",
      "unit": "µg",
      "value": 5,
      "kind": "NRV",
      "note": "GB 28050-2025（2027-03-16实施）更新为10 µg。"
    },
    {
      "nutrient": "vitEMg",
      "unit": "mg α-TE",
      "value": 14,
      "kind": "NRV",
      "note": "2011表A.1原文『14 mg α-TE』，与canonical单位一致。2011与2025版一致。"
    },
    {
      "nutrient": "vitKUg",
      "unit": "µg",
      "value": 80,
      "kind": "NRV",
      "note": "2011与2025版一致。"
    },
    {
      "nutrient": "thiaminMg",
      "unit": "mg",
      "value": 1.4,
      "kind": "NRV",
      "note": "维生素B1（硫胺素）。2011与2025版一致。"
    },
    {
      "nutrient": "riboflavinMg",
      "unit": "mg",
      "value": 1.4,
      "kind": "NRV",
      "note": "维生素B2（核黄素）。2011与2025版一致。"
    },
    {
      "nutrient": "niacinMg",
      "unit": "mg NE",
      "value": 14,
      "kind": "NRV",
      "note": "单位口径：2011表A.1原文为『烟酸 14 mg』，未标注NE（烟酸当量）；canonical键为mg NE，数值按14映射但源未明确NE口径。2011与2025版数值一致。"
    },
    {
      "nutrient": "pantothenicMg",
      "unit": "mg",
      "value": 5,
      "kind": "NRV",
      "note": "泛酸。2011与2025版一致。"
    },
    {
      "nutrient": "vitB6Mg",
      "unit": "mg",
      "value": 1.4,
      "kind": "NRV",
      "note": "2011与2025版一致。"
    },
    {
      "nutrient": "folateUg",
      "unit": "µg DFE",
      "value": 400,
      "kind": "NRV",
      "note": "2011表A.1原文『400 µg DFE』，与canonical单位一致。2011与2025版一致。"
    },
    {
      "nutrient": "vitB12Ug",
      "unit": "µg",
      "value": 2.4,
      "kind": "NRV",
      "note": "2011与2025版一致。"
    },
    {
      "nutrient": "cholineMg",
      "unit": "mg",
      "value": 450,
      "kind": "NRV",
      "note": "GB 28050-2025（2027-03-16实施）更新为500 mg。"
    }
  ]
};

export const US_DRI: {
  source: ReferenceSource;
  caveats: string[];
  groups: { sex: DriSex; age_group: DriAgeGroup; values: ReferenceValue[] }[];
} = {
  "source": {
    "name": "U.S. Dietary Reference Intakes (DRI) — National Academies of Sciences, Engineering, and Medicine (Food and Nutrition Board) / NIH Office of Dietary Supplements",
    "citation": "Institute of Medicine / National Academies of Sciences, Engineering, and Medicine. Dietary Reference Intakes: The Essential Guide to Nutrient Requirements — Summary Tables (RDA/AI for Vitamins, Elements, Macronutrients; Tolerable Upper Intake Levels for Vitamins and Elements). Sodium and potassium values from: National Academies of Sciences, Engineering, and Medicine. 2019. Dietary Reference Intakes for Sodium and Potassium. Washington, DC: The National Academies Press. Cross-checked against NIH ODS Health Professional fact sheets.",
    "urls": [
      "https://www.ncbi.nlm.nih.gov/books/NBK56068/table/summarytables.t2/",
      "https://www.ncbi.nlm.nih.gov/books/NBK56068/table/summarytables.t3/",
      "https://www.ncbi.nlm.nih.gov/books/NBK56068/table/summarytables.t4/",
      "https://www.ncbi.nlm.nih.gov/books/NBK56068/table/summarytables.t7/",
      "https://www.ncbi.nlm.nih.gov/books/NBK56068/table/summarytables.t8/",
      "https://www.ncbi.nlm.nih.gov/books/NBK538102/",
      "https://www.ncbi.nlm.nih.gov/books/n/nap25353/sec_ch9/",
      "https://ods.od.nih.gov/factsheets/Phosphorus-HealthProfessional/",
      "https://ods.od.nih.gov/factsheets/Potassium-HealthProfessional/"
    ]
  },
  "caveats": [
    "能量 (energyKcal) 无 RDA/EAR; DRI 使用 EER (Estimated Energy Requirement), 依身高/体重/年龄/活动水平个体计算, 故填 null。",
    "总脂肪 (fatG) 与饱和脂肪 (satFatG) 成人无 RDA/AI, 填 null; 总脂肪有 AMDR 20-35% 能量, 饱和脂肪建议尽量低。膳食胆固醇 (cholesterolMg) 无 DRI, 建议尽量低, 填 null。",
    "schema 的 kind 字段为必填枚举 (RDA/AI); 对无 RDA/AI 的营养素 (能量/脂肪/饱和脂肪/胆固醇) 因无法留空, 统一标为 RDA 并在 note 中说明其实际无 RDA/AI, 请以 note 为准。",
    "钠 (sodiumMg): 采用 2019 National Academies 更新的 AI = 1500 mg (适用所有 14 岁以上成人, 不再随年龄下降); CDRR (慢性病风险降低摄入量) = 超过 2300 mg/d 应减少; 2019 报告取消了钠的 UL (证据不足)。1997/2004 旧 AI 曾按年龄递减 (1500/1300/1200 mg), 已在 note 标注。",
    "钾 (potassiumMg): 采用 2019 更新值 AI 男 3400 mg / 女 2600 mg (旧 DRI 汇总表为 4700 mg, 已被 2019 报告取代); 钾无 UL。",
    "铜 (copperMg): 官方 RDA 以 µg 表示 (900 µg), 已换算为 0.9 mg 以匹配 canonical 单位; UL 10000 µg = 10 mg。",
    "维生素 E 单位: DRI 以 mg α-tocopherol (RRR-α-生育酚) 定义, 与 canonical 'mg α-TE' 近似但不完全等同旧 α-生育酚当量定义; RDA 15 mg。",
    "UL 适用范围注意: 维生素 A 的 UL (3000 µg) 仅针对预成型维生素 A; 维生素 E/烟酸/叶酸的 UL 仅针对补充剂/强化食品中的合成形式; 镁的 UL (350 mg) 仅针对补充剂 (药理来源), 不含食物和水。",
    "叶酸单位为 µg DFE, UL 1000 µg 仅针对合成叶酸 (folic acid)。烟酸单位为 mg NE, UL 35 mg 仅针对合成/强化形式。",
    "维生素 K、硫胺素、核黄素、维生素 B12、泛酸、钾、钠 (2019)、蛋白质、碳水、纤维、总脂肪均无 UL (upperLimit 为 null)。",
    "铁: 育龄女性 (19-50) RDA 18 mg, 孕期 27 mg (未单列); 绝经后女性 (51+) 降至 8 mg。此表未含孕期/哺乳期分组。",
    "所有数值来自 IOM/National Academies DRI 汇总表 (维生素/元素/宏量三张 RDA-AI 表 + 两张 UL 表), 钠钾另据 2019 专项报告更新; 已逐值核对。"
  ],
  "groups": [
    {
      "sex": "male",
      "age_group": "19-30",
      "values": [
        {
          "nutrient": "energyKcal",
          "unit": "kcal",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/EAR; Estimated Energy Requirement (EER) depends on height, weight, age and physical activity level"
        },
        {
          "nutrient": "proteinG",
          "unit": "g",
          "value": 56,
          "kind": "RDA"
        },
        {
          "nutrient": "fatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI for adults; AMDR 20-35% of energy"
        },
        {
          "nutrient": "satFatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; recommendation is to keep as low as possible"
        },
        {
          "nutrient": "carbG",
          "unit": "g",
          "value": 130,
          "kind": "RDA"
        },
        {
          "nutrient": "fiberG",
          "unit": "g",
          "value": 38,
          "kind": "AI"
        },
        {
          "nutrient": "cholesterolMg",
          "unit": "mg",
          "value": null,
          "kind": "RDA",
          "note": "No DRI established; recommendation is as low as possible"
        },
        {
          "nutrient": "sodiumMg",
          "unit": "mg",
          "value": 1500,
          "kind": "AI",
          "note": "2019 DRI AI = 1500 mg for all adults 14+; CDRR: reduce intake if above 2300 mg/d; no UL established (2019)"
        },
        {
          "nutrient": "potassiumMg",
          "unit": "mg",
          "value": 3400,
          "kind": "AI",
          "note": "2019 DRI update (men); no UL"
        },
        {
          "nutrient": "calciumMg",
          "unit": "mg",
          "value": 1000,
          "kind": "RDA",
          "upper_limit": 2500
        },
        {
          "nutrient": "ironMg",
          "unit": "mg",
          "value": 8,
          "kind": "RDA",
          "upper_limit": 45
        },
        {
          "nutrient": "magnesiumMg",
          "unit": "mg",
          "value": 400,
          "kind": "RDA",
          "upper_limit": 350,
          "note": "UL 350 mg applies to supplemental magnesium (pharmacological) only, not food/water"
        },
        {
          "nutrient": "phosphorusMg",
          "unit": "mg",
          "value": 700,
          "kind": "RDA",
          "upper_limit": 4000
        },
        {
          "nutrient": "zincMg",
          "unit": "mg",
          "value": 11,
          "kind": "RDA",
          "upper_limit": 40
        },
        {
          "nutrient": "copperMg",
          "unit": "mg",
          "value": 0.9,
          "kind": "RDA",
          "upper_limit": 10,
          "note": "RDA 900 µg = 0.9 mg; UL 10000 µg = 10 mg"
        },
        {
          "nutrient": "manganeseMg",
          "unit": "mg",
          "value": 2.3,
          "kind": "AI",
          "upper_limit": 11
        },
        {
          "nutrient": "seleniumUg",
          "unit": "µg",
          "value": 55,
          "kind": "RDA",
          "upper_limit": 400
        },
        {
          "nutrient": "vitAUgRae",
          "unit": "µg RAE",
          "value": 900,
          "kind": "RDA",
          "upper_limit": 3000,
          "note": "UL applies to preformed vitamin A only"
        },
        {
          "nutrient": "vitCMg",
          "unit": "mg",
          "value": 90,
          "kind": "RDA",
          "upper_limit": 2000
        },
        {
          "nutrient": "vitDUg",
          "unit": "µg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "vitEMg",
          "unit": "mg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "mg α-tocopherol; UL applies to supplemental/fortified forms only"
        },
        {
          "nutrient": "vitKUg",
          "unit": "µg",
          "value": 120,
          "kind": "AI"
        },
        {
          "nutrient": "thiaminMg",
          "unit": "mg",
          "value": 1.2,
          "kind": "RDA"
        },
        {
          "nutrient": "riboflavinMg",
          "unit": "mg",
          "value": 1.3,
          "kind": "RDA"
        },
        {
          "nutrient": "niacinMg",
          "unit": "mg NE",
          "value": 16,
          "kind": "RDA",
          "upper_limit": 35,
          "note": "UL 35 mg applies to supplemental/fortified niacin only"
        },
        {
          "nutrient": "pantothenicMg",
          "unit": "mg",
          "value": 5,
          "kind": "AI"
        },
        {
          "nutrient": "vitB6Mg",
          "unit": "mg",
          "value": 1.3,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "folateUg",
          "unit": "µg DFE",
          "value": 400,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "UL 1000 µg applies to synthetic folic acid from supplements/fortified foods only"
        },
        {
          "nutrient": "vitB12Ug",
          "unit": "µg",
          "value": 2.4,
          "kind": "RDA"
        },
        {
          "nutrient": "cholineMg",
          "unit": "mg",
          "value": 550,
          "kind": "AI",
          "upper_limit": 3500,
          "note": "UL 3.5 g = 3500 mg"
        }
      ]
    },
    {
      "sex": "male",
      "age_group": "31-50",
      "values": [
        {
          "nutrient": "energyKcal",
          "unit": "kcal",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/EAR; EER depends on height, weight, age and activity"
        },
        {
          "nutrient": "proteinG",
          "unit": "g",
          "value": 56,
          "kind": "RDA"
        },
        {
          "nutrient": "fatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; AMDR 20-35% of energy"
        },
        {
          "nutrient": "satFatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; keep as low as possible"
        },
        {
          "nutrient": "carbG",
          "unit": "g",
          "value": 130,
          "kind": "RDA"
        },
        {
          "nutrient": "fiberG",
          "unit": "g",
          "value": 38,
          "kind": "AI"
        },
        {
          "nutrient": "cholesterolMg",
          "unit": "mg",
          "value": null,
          "kind": "RDA",
          "note": "No DRI; as low as possible"
        },
        {
          "nutrient": "sodiumMg",
          "unit": "mg",
          "value": 1500,
          "kind": "AI",
          "note": "2019 DRI AI = 1500 mg; CDRR reduce if above 2300 mg/d; no UL"
        },
        {
          "nutrient": "potassiumMg",
          "unit": "mg",
          "value": 3400,
          "kind": "AI",
          "note": "2019 DRI (men); no UL"
        },
        {
          "nutrient": "calciumMg",
          "unit": "mg",
          "value": 1000,
          "kind": "RDA",
          "upper_limit": 2500
        },
        {
          "nutrient": "ironMg",
          "unit": "mg",
          "value": 8,
          "kind": "RDA",
          "upper_limit": 45
        },
        {
          "nutrient": "magnesiumMg",
          "unit": "mg",
          "value": 420,
          "kind": "RDA",
          "upper_limit": 350,
          "note": "UL applies to supplemental magnesium only"
        },
        {
          "nutrient": "phosphorusMg",
          "unit": "mg",
          "value": 700,
          "kind": "RDA",
          "upper_limit": 4000
        },
        {
          "nutrient": "zincMg",
          "unit": "mg",
          "value": 11,
          "kind": "RDA",
          "upper_limit": 40
        },
        {
          "nutrient": "copperMg",
          "unit": "mg",
          "value": 0.9,
          "kind": "RDA",
          "upper_limit": 10,
          "note": "900 µg = 0.9 mg; UL 10 mg"
        },
        {
          "nutrient": "manganeseMg",
          "unit": "mg",
          "value": 2.3,
          "kind": "AI",
          "upper_limit": 11
        },
        {
          "nutrient": "seleniumUg",
          "unit": "µg",
          "value": 55,
          "kind": "RDA",
          "upper_limit": 400
        },
        {
          "nutrient": "vitAUgRae",
          "unit": "µg RAE",
          "value": 900,
          "kind": "RDA",
          "upper_limit": 3000,
          "note": "UL = preformed vitamin A only"
        },
        {
          "nutrient": "vitCMg",
          "unit": "mg",
          "value": 90,
          "kind": "RDA",
          "upper_limit": 2000
        },
        {
          "nutrient": "vitDUg",
          "unit": "µg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "vitEMg",
          "unit": "mg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "mg α-tocopherol; UL = supplemental forms"
        },
        {
          "nutrient": "vitKUg",
          "unit": "µg",
          "value": 120,
          "kind": "AI"
        },
        {
          "nutrient": "thiaminMg",
          "unit": "mg",
          "value": 1.2,
          "kind": "RDA"
        },
        {
          "nutrient": "riboflavinMg",
          "unit": "mg",
          "value": 1.3,
          "kind": "RDA"
        },
        {
          "nutrient": "niacinMg",
          "unit": "mg NE",
          "value": 16,
          "kind": "RDA",
          "upper_limit": 35,
          "note": "UL = supplemental/fortified niacin"
        },
        {
          "nutrient": "pantothenicMg",
          "unit": "mg",
          "value": 5,
          "kind": "AI"
        },
        {
          "nutrient": "vitB6Mg",
          "unit": "mg",
          "value": 1.3,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "folateUg",
          "unit": "µg DFE",
          "value": 400,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "UL = synthetic folic acid only"
        },
        {
          "nutrient": "vitB12Ug",
          "unit": "µg",
          "value": 2.4,
          "kind": "RDA"
        },
        {
          "nutrient": "cholineMg",
          "unit": "mg",
          "value": 550,
          "kind": "AI",
          "upper_limit": 3500
        }
      ]
    },
    {
      "sex": "male",
      "age_group": "51-70",
      "values": [
        {
          "nutrient": "energyKcal",
          "unit": "kcal",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/EAR; EER depends on height, weight, age and activity"
        },
        {
          "nutrient": "proteinG",
          "unit": "g",
          "value": 56,
          "kind": "RDA"
        },
        {
          "nutrient": "fatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; AMDR 20-35%"
        },
        {
          "nutrient": "satFatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; as low as possible"
        },
        {
          "nutrient": "carbG",
          "unit": "g",
          "value": 130,
          "kind": "RDA"
        },
        {
          "nutrient": "fiberG",
          "unit": "g",
          "value": 30,
          "kind": "AI"
        },
        {
          "nutrient": "cholesterolMg",
          "unit": "mg",
          "value": null,
          "kind": "RDA",
          "note": "No DRI; as low as possible"
        },
        {
          "nutrient": "sodiumMg",
          "unit": "mg",
          "value": 1500,
          "kind": "AI",
          "note": "2019 DRI AI = 1500 mg; CDRR reduce if above 2300 mg/d; no UL. (Pre-2019 AI for 51-70 was 1300 mg)"
        },
        {
          "nutrient": "potassiumMg",
          "unit": "mg",
          "value": 3400,
          "kind": "AI",
          "note": "2019 DRI (men); no UL"
        },
        {
          "nutrient": "calciumMg",
          "unit": "mg",
          "value": 1000,
          "kind": "RDA",
          "upper_limit": 2000
        },
        {
          "nutrient": "ironMg",
          "unit": "mg",
          "value": 8,
          "kind": "RDA",
          "upper_limit": 45
        },
        {
          "nutrient": "magnesiumMg",
          "unit": "mg",
          "value": 420,
          "kind": "RDA",
          "upper_limit": 350,
          "note": "UL = supplemental magnesium only"
        },
        {
          "nutrient": "phosphorusMg",
          "unit": "mg",
          "value": 700,
          "kind": "RDA",
          "upper_limit": 4000
        },
        {
          "nutrient": "zincMg",
          "unit": "mg",
          "value": 11,
          "kind": "RDA",
          "upper_limit": 40
        },
        {
          "nutrient": "copperMg",
          "unit": "mg",
          "value": 0.9,
          "kind": "RDA",
          "upper_limit": 10,
          "note": "900 µg = 0.9 mg; UL 10 mg"
        },
        {
          "nutrient": "manganeseMg",
          "unit": "mg",
          "value": 2.3,
          "kind": "AI",
          "upper_limit": 11
        },
        {
          "nutrient": "seleniumUg",
          "unit": "µg",
          "value": 55,
          "kind": "RDA",
          "upper_limit": 400
        },
        {
          "nutrient": "vitAUgRae",
          "unit": "µg RAE",
          "value": 900,
          "kind": "RDA",
          "upper_limit": 3000,
          "note": "UL = preformed vitamin A only"
        },
        {
          "nutrient": "vitCMg",
          "unit": "mg",
          "value": 90,
          "kind": "RDA",
          "upper_limit": 2000
        },
        {
          "nutrient": "vitDUg",
          "unit": "µg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "vitEMg",
          "unit": "mg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "mg α-tocopherol; UL = supplemental forms"
        },
        {
          "nutrient": "vitKUg",
          "unit": "µg",
          "value": 120,
          "kind": "AI"
        },
        {
          "nutrient": "thiaminMg",
          "unit": "mg",
          "value": 1.2,
          "kind": "RDA"
        },
        {
          "nutrient": "riboflavinMg",
          "unit": "mg",
          "value": 1.3,
          "kind": "RDA"
        },
        {
          "nutrient": "niacinMg",
          "unit": "mg NE",
          "value": 16,
          "kind": "RDA",
          "upper_limit": 35,
          "note": "UL = supplemental/fortified niacin"
        },
        {
          "nutrient": "pantothenicMg",
          "unit": "mg",
          "value": 5,
          "kind": "AI"
        },
        {
          "nutrient": "vitB6Mg",
          "unit": "mg",
          "value": 1.7,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "folateUg",
          "unit": "µg DFE",
          "value": 400,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "UL = synthetic folic acid only"
        },
        {
          "nutrient": "vitB12Ug",
          "unit": "µg",
          "value": 2.4,
          "kind": "RDA",
          "note": "Adults >50 advised to obtain B12 mainly from fortified foods or supplements"
        },
        {
          "nutrient": "cholineMg",
          "unit": "mg",
          "value": 550,
          "kind": "AI",
          "upper_limit": 3500
        }
      ]
    },
    {
      "sex": "male",
      "age_group": "71+",
      "values": [
        {
          "nutrient": "energyKcal",
          "unit": "kcal",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/EAR; EER depends on height, weight, age and activity"
        },
        {
          "nutrient": "proteinG",
          "unit": "g",
          "value": 56,
          "kind": "RDA"
        },
        {
          "nutrient": "fatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; AMDR 20-35%"
        },
        {
          "nutrient": "satFatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; as low as possible"
        },
        {
          "nutrient": "carbG",
          "unit": "g",
          "value": 130,
          "kind": "RDA"
        },
        {
          "nutrient": "fiberG",
          "unit": "g",
          "value": 30,
          "kind": "AI"
        },
        {
          "nutrient": "cholesterolMg",
          "unit": "mg",
          "value": null,
          "kind": "RDA",
          "note": "No DRI; as low as possible"
        },
        {
          "nutrient": "sodiumMg",
          "unit": "mg",
          "value": 1500,
          "kind": "AI",
          "note": "2019 DRI AI = 1500 mg; CDRR reduce if above 2300 mg/d; no UL. (Pre-2019 AI for >70 was 1200 mg)"
        },
        {
          "nutrient": "potassiumMg",
          "unit": "mg",
          "value": 3400,
          "kind": "AI",
          "note": "2019 DRI (men); no UL"
        },
        {
          "nutrient": "calciumMg",
          "unit": "mg",
          "value": 1200,
          "kind": "RDA",
          "upper_limit": 2000
        },
        {
          "nutrient": "ironMg",
          "unit": "mg",
          "value": 8,
          "kind": "RDA",
          "upper_limit": 45
        },
        {
          "nutrient": "magnesiumMg",
          "unit": "mg",
          "value": 420,
          "kind": "RDA",
          "upper_limit": 350,
          "note": "UL = supplemental magnesium only"
        },
        {
          "nutrient": "phosphorusMg",
          "unit": "mg",
          "value": 700,
          "kind": "RDA",
          "upper_limit": 3000,
          "note": "UL for ages 71+ is 3000 mg (vs 4000 mg for 19-70)"
        },
        {
          "nutrient": "zincMg",
          "unit": "mg",
          "value": 11,
          "kind": "RDA",
          "upper_limit": 40
        },
        {
          "nutrient": "copperMg",
          "unit": "mg",
          "value": 0.9,
          "kind": "RDA",
          "upper_limit": 10,
          "note": "900 µg = 0.9 mg; UL 10 mg"
        },
        {
          "nutrient": "manganeseMg",
          "unit": "mg",
          "value": 2.3,
          "kind": "AI",
          "upper_limit": 11
        },
        {
          "nutrient": "seleniumUg",
          "unit": "µg",
          "value": 55,
          "kind": "RDA",
          "upper_limit": 400
        },
        {
          "nutrient": "vitAUgRae",
          "unit": "µg RAE",
          "value": 900,
          "kind": "RDA",
          "upper_limit": 3000,
          "note": "UL = preformed vitamin A only"
        },
        {
          "nutrient": "vitCMg",
          "unit": "mg",
          "value": 90,
          "kind": "RDA",
          "upper_limit": 2000
        },
        {
          "nutrient": "vitDUg",
          "unit": "µg",
          "value": 20,
          "kind": "RDA",
          "upper_limit": 100,
          "note": "RDA increases to 20 µg (800 IU) for >70 y"
        },
        {
          "nutrient": "vitEMg",
          "unit": "mg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "mg α-tocopherol; UL = supplemental forms"
        },
        {
          "nutrient": "vitKUg",
          "unit": "µg",
          "value": 120,
          "kind": "AI"
        },
        {
          "nutrient": "thiaminMg",
          "unit": "mg",
          "value": 1.2,
          "kind": "RDA"
        },
        {
          "nutrient": "riboflavinMg",
          "unit": "mg",
          "value": 1.3,
          "kind": "RDA"
        },
        {
          "nutrient": "niacinMg",
          "unit": "mg NE",
          "value": 16,
          "kind": "RDA",
          "upper_limit": 35,
          "note": "UL = supplemental/fortified niacin"
        },
        {
          "nutrient": "pantothenicMg",
          "unit": "mg",
          "value": 5,
          "kind": "AI"
        },
        {
          "nutrient": "vitB6Mg",
          "unit": "mg",
          "value": 1.7,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "folateUg",
          "unit": "µg DFE",
          "value": 400,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "UL = synthetic folic acid only"
        },
        {
          "nutrient": "vitB12Ug",
          "unit": "µg",
          "value": 2.4,
          "kind": "RDA",
          "note": "Advised to obtain B12 mainly from fortified foods or supplements"
        },
        {
          "nutrient": "cholineMg",
          "unit": "mg",
          "value": 550,
          "kind": "AI",
          "upper_limit": 3500
        }
      ]
    },
    {
      "sex": "female",
      "age_group": "19-30",
      "values": [
        {
          "nutrient": "energyKcal",
          "unit": "kcal",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/EAR; EER depends on height, weight, age and activity"
        },
        {
          "nutrient": "proteinG",
          "unit": "g",
          "value": 46,
          "kind": "RDA"
        },
        {
          "nutrient": "fatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; AMDR 20-35%"
        },
        {
          "nutrient": "satFatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; as low as possible"
        },
        {
          "nutrient": "carbG",
          "unit": "g",
          "value": 130,
          "kind": "RDA"
        },
        {
          "nutrient": "fiberG",
          "unit": "g",
          "value": 25,
          "kind": "AI"
        },
        {
          "nutrient": "cholesterolMg",
          "unit": "mg",
          "value": null,
          "kind": "RDA",
          "note": "No DRI; as low as possible"
        },
        {
          "nutrient": "sodiumMg",
          "unit": "mg",
          "value": 1500,
          "kind": "AI",
          "note": "2019 DRI AI = 1500 mg; CDRR reduce if above 2300 mg/d; no UL"
        },
        {
          "nutrient": "potassiumMg",
          "unit": "mg",
          "value": 2600,
          "kind": "AI",
          "note": "2019 DRI update (women); no UL"
        },
        {
          "nutrient": "calciumMg",
          "unit": "mg",
          "value": 1000,
          "kind": "RDA",
          "upper_limit": 2500
        },
        {
          "nutrient": "ironMg",
          "unit": "mg",
          "value": 18,
          "kind": "RDA",
          "upper_limit": 45,
          "note": "Higher for menstruating women; 27 mg in pregnancy"
        },
        {
          "nutrient": "magnesiumMg",
          "unit": "mg",
          "value": 310,
          "kind": "RDA",
          "upper_limit": 350,
          "note": "UL = supplemental magnesium only"
        },
        {
          "nutrient": "phosphorusMg",
          "unit": "mg",
          "value": 700,
          "kind": "RDA",
          "upper_limit": 4000
        },
        {
          "nutrient": "zincMg",
          "unit": "mg",
          "value": 8,
          "kind": "RDA",
          "upper_limit": 40
        },
        {
          "nutrient": "copperMg",
          "unit": "mg",
          "value": 0.9,
          "kind": "RDA",
          "upper_limit": 10,
          "note": "900 µg = 0.9 mg; UL 10 mg"
        },
        {
          "nutrient": "manganeseMg",
          "unit": "mg",
          "value": 1.8,
          "kind": "AI",
          "upper_limit": 11
        },
        {
          "nutrient": "seleniumUg",
          "unit": "µg",
          "value": 55,
          "kind": "RDA",
          "upper_limit": 400
        },
        {
          "nutrient": "vitAUgRae",
          "unit": "µg RAE",
          "value": 700,
          "kind": "RDA",
          "upper_limit": 3000,
          "note": "UL = preformed vitamin A only"
        },
        {
          "nutrient": "vitCMg",
          "unit": "mg",
          "value": 75,
          "kind": "RDA",
          "upper_limit": 2000
        },
        {
          "nutrient": "vitDUg",
          "unit": "µg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "vitEMg",
          "unit": "mg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "mg α-tocopherol; UL = supplemental forms"
        },
        {
          "nutrient": "vitKUg",
          "unit": "µg",
          "value": 90,
          "kind": "AI"
        },
        {
          "nutrient": "thiaminMg",
          "unit": "mg",
          "value": 1.1,
          "kind": "RDA"
        },
        {
          "nutrient": "riboflavinMg",
          "unit": "mg",
          "value": 1.1,
          "kind": "RDA"
        },
        {
          "nutrient": "niacinMg",
          "unit": "mg NE",
          "value": 14,
          "kind": "RDA",
          "upper_limit": 35,
          "note": "UL = supplemental/fortified niacin"
        },
        {
          "nutrient": "pantothenicMg",
          "unit": "mg",
          "value": 5,
          "kind": "AI"
        },
        {
          "nutrient": "vitB6Mg",
          "unit": "mg",
          "value": 1.3,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "folateUg",
          "unit": "µg DFE",
          "value": 400,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "UL = synthetic folic acid only; women capable of pregnancy advised 400 µg folic acid from supplements/fortified foods"
        },
        {
          "nutrient": "vitB12Ug",
          "unit": "µg",
          "value": 2.4,
          "kind": "RDA"
        },
        {
          "nutrient": "cholineMg",
          "unit": "mg",
          "value": 425,
          "kind": "AI",
          "upper_limit": 3500
        }
      ]
    },
    {
      "sex": "female",
      "age_group": "31-50",
      "values": [
        {
          "nutrient": "energyKcal",
          "unit": "kcal",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/EAR; EER depends on height, weight, age and activity"
        },
        {
          "nutrient": "proteinG",
          "unit": "g",
          "value": 46,
          "kind": "RDA"
        },
        {
          "nutrient": "fatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; AMDR 20-35%"
        },
        {
          "nutrient": "satFatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; as low as possible"
        },
        {
          "nutrient": "carbG",
          "unit": "g",
          "value": 130,
          "kind": "RDA"
        },
        {
          "nutrient": "fiberG",
          "unit": "g",
          "value": 25,
          "kind": "AI"
        },
        {
          "nutrient": "cholesterolMg",
          "unit": "mg",
          "value": null,
          "kind": "RDA",
          "note": "No DRI; as low as possible"
        },
        {
          "nutrient": "sodiumMg",
          "unit": "mg",
          "value": 1500,
          "kind": "AI",
          "note": "2019 DRI AI = 1500 mg; CDRR reduce if above 2300 mg/d; no UL"
        },
        {
          "nutrient": "potassiumMg",
          "unit": "mg",
          "value": 2600,
          "kind": "AI",
          "note": "2019 DRI (women); no UL"
        },
        {
          "nutrient": "calciumMg",
          "unit": "mg",
          "value": 1000,
          "kind": "RDA",
          "upper_limit": 2500
        },
        {
          "nutrient": "ironMg",
          "unit": "mg",
          "value": 18,
          "kind": "RDA",
          "upper_limit": 45,
          "note": "27 mg in pregnancy"
        },
        {
          "nutrient": "magnesiumMg",
          "unit": "mg",
          "value": 320,
          "kind": "RDA",
          "upper_limit": 350,
          "note": "UL = supplemental magnesium only"
        },
        {
          "nutrient": "phosphorusMg",
          "unit": "mg",
          "value": 700,
          "kind": "RDA",
          "upper_limit": 4000
        },
        {
          "nutrient": "zincMg",
          "unit": "mg",
          "value": 8,
          "kind": "RDA",
          "upper_limit": 40
        },
        {
          "nutrient": "copperMg",
          "unit": "mg",
          "value": 0.9,
          "kind": "RDA",
          "upper_limit": 10,
          "note": "900 µg = 0.9 mg; UL 10 mg"
        },
        {
          "nutrient": "manganeseMg",
          "unit": "mg",
          "value": 1.8,
          "kind": "AI",
          "upper_limit": 11
        },
        {
          "nutrient": "seleniumUg",
          "unit": "µg",
          "value": 55,
          "kind": "RDA",
          "upper_limit": 400
        },
        {
          "nutrient": "vitAUgRae",
          "unit": "µg RAE",
          "value": 700,
          "kind": "RDA",
          "upper_limit": 3000,
          "note": "UL = preformed vitamin A only"
        },
        {
          "nutrient": "vitCMg",
          "unit": "mg",
          "value": 75,
          "kind": "RDA",
          "upper_limit": 2000
        },
        {
          "nutrient": "vitDUg",
          "unit": "µg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "vitEMg",
          "unit": "mg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "mg α-tocopherol; UL = supplemental forms"
        },
        {
          "nutrient": "vitKUg",
          "unit": "µg",
          "value": 90,
          "kind": "AI"
        },
        {
          "nutrient": "thiaminMg",
          "unit": "mg",
          "value": 1.1,
          "kind": "RDA"
        },
        {
          "nutrient": "riboflavinMg",
          "unit": "mg",
          "value": 1.1,
          "kind": "RDA"
        },
        {
          "nutrient": "niacinMg",
          "unit": "mg NE",
          "value": 14,
          "kind": "RDA",
          "upper_limit": 35,
          "note": "UL = supplemental/fortified niacin"
        },
        {
          "nutrient": "pantothenicMg",
          "unit": "mg",
          "value": 5,
          "kind": "AI"
        },
        {
          "nutrient": "vitB6Mg",
          "unit": "mg",
          "value": 1.3,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "folateUg",
          "unit": "µg DFE",
          "value": 400,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "UL = synthetic folic acid only; women capable of pregnancy advised 400 µg folic acid"
        },
        {
          "nutrient": "vitB12Ug",
          "unit": "µg",
          "value": 2.4,
          "kind": "RDA"
        },
        {
          "nutrient": "cholineMg",
          "unit": "mg",
          "value": 425,
          "kind": "AI",
          "upper_limit": 3500
        }
      ]
    },
    {
      "sex": "female",
      "age_group": "51-70",
      "values": [
        {
          "nutrient": "energyKcal",
          "unit": "kcal",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/EAR; EER depends on height, weight, age and activity"
        },
        {
          "nutrient": "proteinG",
          "unit": "g",
          "value": 46,
          "kind": "RDA"
        },
        {
          "nutrient": "fatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; AMDR 20-35%"
        },
        {
          "nutrient": "satFatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; as low as possible"
        },
        {
          "nutrient": "carbG",
          "unit": "g",
          "value": 130,
          "kind": "RDA"
        },
        {
          "nutrient": "fiberG",
          "unit": "g",
          "value": 21,
          "kind": "AI"
        },
        {
          "nutrient": "cholesterolMg",
          "unit": "mg",
          "value": null,
          "kind": "RDA",
          "note": "No DRI; as low as possible"
        },
        {
          "nutrient": "sodiumMg",
          "unit": "mg",
          "value": 1500,
          "kind": "AI",
          "note": "2019 DRI AI = 1500 mg; CDRR reduce if above 2300 mg/d; no UL. (Pre-2019 AI for 51-70 was 1300 mg)"
        },
        {
          "nutrient": "potassiumMg",
          "unit": "mg",
          "value": 2600,
          "kind": "AI",
          "note": "2019 DRI (women); no UL"
        },
        {
          "nutrient": "calciumMg",
          "unit": "mg",
          "value": 1200,
          "kind": "RDA",
          "upper_limit": 2000,
          "note": "RDA increases to 1200 mg for women 51+"
        },
        {
          "nutrient": "ironMg",
          "unit": "mg",
          "value": 8,
          "kind": "RDA",
          "upper_limit": 45,
          "note": "Drops to 8 mg post-menopause"
        },
        {
          "nutrient": "magnesiumMg",
          "unit": "mg",
          "value": 320,
          "kind": "RDA",
          "upper_limit": 350,
          "note": "UL = supplemental magnesium only"
        },
        {
          "nutrient": "phosphorusMg",
          "unit": "mg",
          "value": 700,
          "kind": "RDA",
          "upper_limit": 4000
        },
        {
          "nutrient": "zincMg",
          "unit": "mg",
          "value": 8,
          "kind": "RDA",
          "upper_limit": 40
        },
        {
          "nutrient": "copperMg",
          "unit": "mg",
          "value": 0.9,
          "kind": "RDA",
          "upper_limit": 10,
          "note": "900 µg = 0.9 mg; UL 10 mg"
        },
        {
          "nutrient": "manganeseMg",
          "unit": "mg",
          "value": 1.8,
          "kind": "AI",
          "upper_limit": 11
        },
        {
          "nutrient": "seleniumUg",
          "unit": "µg",
          "value": 55,
          "kind": "RDA",
          "upper_limit": 400
        },
        {
          "nutrient": "vitAUgRae",
          "unit": "µg RAE",
          "value": 700,
          "kind": "RDA",
          "upper_limit": 3000,
          "note": "UL = preformed vitamin A only"
        },
        {
          "nutrient": "vitCMg",
          "unit": "mg",
          "value": 75,
          "kind": "RDA",
          "upper_limit": 2000
        },
        {
          "nutrient": "vitDUg",
          "unit": "µg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "vitEMg",
          "unit": "mg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "mg α-tocopherol; UL = supplemental forms"
        },
        {
          "nutrient": "vitKUg",
          "unit": "µg",
          "value": 90,
          "kind": "AI"
        },
        {
          "nutrient": "thiaminMg",
          "unit": "mg",
          "value": 1.1,
          "kind": "RDA"
        },
        {
          "nutrient": "riboflavinMg",
          "unit": "mg",
          "value": 1.1,
          "kind": "RDA"
        },
        {
          "nutrient": "niacinMg",
          "unit": "mg NE",
          "value": 14,
          "kind": "RDA",
          "upper_limit": 35,
          "note": "UL = supplemental/fortified niacin"
        },
        {
          "nutrient": "pantothenicMg",
          "unit": "mg",
          "value": 5,
          "kind": "AI"
        },
        {
          "nutrient": "vitB6Mg",
          "unit": "mg",
          "value": 1.5,
          "kind": "RDA",
          "upper_limit": 100,
          "note": "RDA increases to 1.5 mg for women 51+"
        },
        {
          "nutrient": "folateUg",
          "unit": "µg DFE",
          "value": 400,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "UL = synthetic folic acid only"
        },
        {
          "nutrient": "vitB12Ug",
          "unit": "µg",
          "value": 2.4,
          "kind": "RDA",
          "note": "Adults >50 advised to obtain B12 mainly from fortified foods or supplements"
        },
        {
          "nutrient": "cholineMg",
          "unit": "mg",
          "value": 425,
          "kind": "AI",
          "upper_limit": 3500
        }
      ]
    },
    {
      "sex": "female",
      "age_group": "71+",
      "values": [
        {
          "nutrient": "energyKcal",
          "unit": "kcal",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/EAR; EER depends on height, weight, age and activity"
        },
        {
          "nutrient": "proteinG",
          "unit": "g",
          "value": 46,
          "kind": "RDA"
        },
        {
          "nutrient": "fatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; AMDR 20-35%"
        },
        {
          "nutrient": "satFatG",
          "unit": "g",
          "value": null,
          "kind": "RDA",
          "note": "No RDA/AI; as low as possible"
        },
        {
          "nutrient": "carbG",
          "unit": "g",
          "value": 130,
          "kind": "RDA"
        },
        {
          "nutrient": "fiberG",
          "unit": "g",
          "value": 21,
          "kind": "AI"
        },
        {
          "nutrient": "cholesterolMg",
          "unit": "mg",
          "value": null,
          "kind": "RDA",
          "note": "No DRI; as low as possible"
        },
        {
          "nutrient": "sodiumMg",
          "unit": "mg",
          "value": 1500,
          "kind": "AI",
          "note": "2019 DRI AI = 1500 mg; CDRR reduce if above 2300 mg/d; no UL. (Pre-2019 AI for >70 was 1200 mg)"
        },
        {
          "nutrient": "potassiumMg",
          "unit": "mg",
          "value": 2600,
          "kind": "AI",
          "note": "2019 DRI (women); no UL"
        },
        {
          "nutrient": "calciumMg",
          "unit": "mg",
          "value": 1200,
          "kind": "RDA",
          "upper_limit": 2000
        },
        {
          "nutrient": "ironMg",
          "unit": "mg",
          "value": 8,
          "kind": "RDA",
          "upper_limit": 45
        },
        {
          "nutrient": "magnesiumMg",
          "unit": "mg",
          "value": 320,
          "kind": "RDA",
          "upper_limit": 350,
          "note": "UL = supplemental magnesium only"
        },
        {
          "nutrient": "phosphorusMg",
          "unit": "mg",
          "value": 700,
          "kind": "RDA",
          "upper_limit": 3000,
          "note": "UL for ages 71+ is 3000 mg (vs 4000 mg for 19-70)"
        },
        {
          "nutrient": "zincMg",
          "unit": "mg",
          "value": 8,
          "kind": "RDA",
          "upper_limit": 40
        },
        {
          "nutrient": "copperMg",
          "unit": "mg",
          "value": 0.9,
          "kind": "RDA",
          "upper_limit": 10,
          "note": "900 µg = 0.9 mg; UL 10 mg"
        },
        {
          "nutrient": "manganeseMg",
          "unit": "mg",
          "value": 1.8,
          "kind": "AI",
          "upper_limit": 11
        },
        {
          "nutrient": "seleniumUg",
          "unit": "µg",
          "value": 55,
          "kind": "RDA",
          "upper_limit": 400
        },
        {
          "nutrient": "vitAUgRae",
          "unit": "µg RAE",
          "value": 700,
          "kind": "RDA",
          "upper_limit": 3000,
          "note": "UL = preformed vitamin A only"
        },
        {
          "nutrient": "vitCMg",
          "unit": "mg",
          "value": 75,
          "kind": "RDA",
          "upper_limit": 2000
        },
        {
          "nutrient": "vitDUg",
          "unit": "µg",
          "value": 20,
          "kind": "RDA",
          "upper_limit": 100,
          "note": "RDA increases to 20 µg (800 IU) for >70 y"
        },
        {
          "nutrient": "vitEMg",
          "unit": "mg",
          "value": 15,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "mg α-tocopherol; UL = supplemental forms"
        },
        {
          "nutrient": "vitKUg",
          "unit": "µg",
          "value": 90,
          "kind": "AI"
        },
        {
          "nutrient": "thiaminMg",
          "unit": "mg",
          "value": 1.1,
          "kind": "RDA"
        },
        {
          "nutrient": "riboflavinMg",
          "unit": "mg",
          "value": 1.1,
          "kind": "RDA"
        },
        {
          "nutrient": "niacinMg",
          "unit": "mg NE",
          "value": 14,
          "kind": "RDA",
          "upper_limit": 35,
          "note": "UL = supplemental/fortified niacin"
        },
        {
          "nutrient": "pantothenicMg",
          "unit": "mg",
          "value": 5,
          "kind": "AI"
        },
        {
          "nutrient": "vitB6Mg",
          "unit": "mg",
          "value": 1.5,
          "kind": "RDA",
          "upper_limit": 100
        },
        {
          "nutrient": "folateUg",
          "unit": "µg DFE",
          "value": 400,
          "kind": "RDA",
          "upper_limit": 1000,
          "note": "UL = synthetic folic acid only"
        },
        {
          "nutrient": "vitB12Ug",
          "unit": "µg",
          "value": 2.4,
          "kind": "RDA",
          "note": "Advised to obtain B12 mainly from fortified foods or supplements"
        },
        {
          "nutrient": "cholineMg",
          "unit": "mg",
          "value": 425,
          "kind": "AI",
          "upper_limit": 3500
        }
      ]
    }
  ]
};

/** Adult DRI age bracket for an age in years (adults only; <19 not covered). */
export function driAgeGroup(age: number): DriAgeGroup {
  if (age <= 30) return '19-30';
  if (age <= 50) return '31-50';
  if (age <= 70) return '51-70';
  return '71+';
}
