"""
Parse the 2025 National Hypertension Guideline PDF text into knowledge base entries.
Replaces old hypertension entries with comprehensive new ones from this authoritative source.
"""
import json
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

SOURCE = "国家基层高血压防治管理指南(2025版)"
CONDITION = "高血压"

# Manually curated entries based on the guideline content
# Each entry covers a key clinical topic that users might ask about
entries = [
    {
        "id": "bp2025-001",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "高血压诊断标准(2025版)",
        "content": "诊室血压诊断标准：4周内非同日3次规范测量的诊室血压均≥140/90mmHg。家庭血压诊断标准：规范测量的家庭血压平均值≥135/85mmHg（建议测量5-7天，早晚各1次，每次2-3遍）。动态血压诊断标准：24小时平均值≥130/80mmHg，或白天平均值≥135/85mmHg，或夜间平均值≥120/70mmHg。",
        "evidence_level": "A",
        "tags": ["高血压", "诊断标准", "血压测量", "诊室血压", "家庭血压", "动态血压"]
    },
    {
        "id": "bp2025-002",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "血压分类与定义",
        "content": "正常血压：收缩压<120mmHg且舒张压<80mmHg。正常高值血压：收缩压120-139mmHg和(或)舒张压80-89mmHg。高血压：收缩压≥140mmHg和(或)舒张压≥90mmHg。单纯收缩期高血压：收缩压≥140mmHg且舒张压<90mmHg。单纯舒张期高血压：收缩压<140mmHg且舒张压≥90mmHg。",
        "evidence_level": "A",
        "tags": ["高血压", "血压分类", "正常血压", "正常高值", "收缩压", "舒张压"]
    },
    {
        "id": "bp2025-003",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "血压测量规范(三要点)",
        "content": "血压测量三要点：设备精准、安静放松、位置规范。设备精准：选择经准确度验证的上臂式医用电子血压计，定期校准，不推荐腕式或手指式。安静放松：测量前30分钟内禁止吸烟、饮咖啡或茶，排空膀胱，安静休息至少5分钟，取坐位，双脚平放，背靠椅背。位置规范：上臂中点与心脏处于同一水平线上，袖带下缘在肘窝上2.5cm。首诊测双臂，以后测较高一侧；每次测两次取平均值，差异>10mmHg则测第三次取后两次平均。",
        "evidence_level": "A",
        "tags": ["高血压", "血压测量", "测量方法", "电子血压计", "袖带"]
    },
    {
        "id": "bp2025-004",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "降压目标(2025版)",
        "content": "对于<80岁的高血压患者，推荐诊室血压降至130/80mmHg以下。对于≥80岁的高血压患者，建议诊室血压降至150/90mmHg以下，可耐受者进一步降至140/90mmHg以下。治疗三原则：达标、平稳、综合管理。不论采用何种治疗，将血压控制在目标值以下是根本。",
        "evidence_level": "A",
        "tags": ["高血压", "降压目标", "血压控制", "老年人", "治疗原则"]
    },
    {
        "id": "bp2025-005",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "生活方式干预(健康八部曲)",
        "content": "健康生活方式八部曲：限盐减重多运动，戒烟戒酒心态平，营养平衡睡得香。具体目标：(1)合理膳食(DASH饮食可降低收缩压11.4mmHg)；(2)减少钠盐摄入每日<5g，增加钾摄入(每减少1g盐可降压1.2mmHg)；(3)减轻体重BMI<24，腰围男<90cm女<85cm(减重10kg可降压5-20mmHg)；(4)规律运动每次≥30分钟每周5-7次(可降压5-7mmHg)；(5)戒烟，避免被动吸烟和电子烟；(6)推荐不饮酒，建议戒酒；(7)减轻精神压力保持心情愉悦；(8)规律作息每晚7-9小时。",
        "evidence_level": "A",
        "tags": ["高血压", "生活方式", "限盐", "减重", "运动", "DASH饮食", "戒烟", "戒酒", "睡眠"]
    },
    {
        "id": "bp2025-006",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "降压药物五大类及选择",
        "content": "五大类降压药：(A)ACEI(如依那普利、贝那普利)和ARB(如缬沙坦、氯沙坦)；(B)β受体阻滞剂(如美托洛尔、比索洛尔)；(C)CCB钙拮抗剂(如氨氯地平、硝苯地平控释片)；(D)利尿剂(如氢氯噻嗪、吲达帕胺)。无合并症高血压首选：A/B/C/D类均可作为初始治疗和长期维持用药。优先推荐长效制剂，保证每日一次服药即可维持24小时平稳降压。ACEI与ARB降压机制相似，不联合使用。",
        "evidence_level": "A",
        "tags": ["高血压", "降压药", "ACEI", "ARB", "CCB", "利尿剂", "β受体阻滞剂", "药物选择"]
    },
    {
        "id": "bp2025-007",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "联合用药方案",
        "content": "起始联合治疗适用于血压≥160/100mmHg或高于目标血压20/10mmHg的高血压患者。优选联合方案(任选其一)：A+C(ACEI/ARB+CCB)、A+D(ACEI/ARB+利尿剂)、C+D(CCB+利尿剂)。推荐单片复方制剂(SPC)提高依从性。次选联合方案：A+C+D(ACEI/ARB+CCB+利尿剂)为三药联合优选。不推荐ACEI+ARB联合。难治性高血压(三药足量仍不达标)加用螺内酯或α受体阻滞剂。",
        "evidence_level": "A",
        "tags": ["高血压", "联合用药", "单片复方", "难治性高血压", "药物组合"]
    },
    {
        "id": "bp2025-008",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "合并症用药推荐",
        "content": "合并冠心病：优选β受体阻滞剂+ACEI/ARB(心梗后)或CCB(稳定性心绞痛)。合并心力衰竭：优选ACEI/ARB/ARNI+β受体阻滞剂+利尿剂+醛固酮受体拮抗剂，推荐沙库巴曲缬沙坦(ARNI)。合并脑卒中：优选ACEI/ARB+CCB或利尿剂。合并慢性肾脏病(蛋白尿)：优选ACEI/ARB。合并糖尿病：优选ACEI/ARB，联合CCB或利尿剂。合并外周动脉疾病：优选ACEI/ARB+CCB。",
        "evidence_level": "A",
        "tags": ["高血压", "合并症", "冠心病", "心力衰竭", "脑卒中", "肾病", "糖尿病", "用药推荐"]
    },
    {
        "id": "bp2025-009",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "初始用药剂量与调药原则",
        "content": "起始剂量：建议采用常规剂量(非低剂量起始)。如单药治疗血压未达标，优先联合不同类别药物而非加大单药剂量。调药频率：初始治疗或调药后2-4周评估疗效，如未达标则调整方案。若使用2种药物足量仍不达标，加用第3种药物。长效制剂优于短效制剂，每日1次优于每日多次。服药时间：一般建议清晨服药；如有夜间血压升高者，可睡前加服一次降压药(但需排除夜间低血压风险)。",
        "evidence_level": "B",
        "tags": ["高血压", "起始剂量", "调药", "服药时间", "长效制剂", "药物调整"]
    },
    {
        "id": "bp2025-010",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "随访管理要求",
        "content": "常规随访：血压达标且稳定者，每3个月至少随访1次，每年进行1次综合评估。强化随访：血压未达标或刚调药者，每月至少随访1次直至达标。随访内容：测量血压、评估症状、检查药物依从性、监测不良反应、评估生活方式干预执行情况。年度评估：更新病史、体格检查、辅助检查(血常规、尿常规、生化、心电图等)。建议鼓励患者进行家庭血压监测并记录。",
        "evidence_level": "B",
        "tags": ["高血压", "随访", "管理", "血压监测", "年度评估", "依从性"]
    },
    {
        "id": "bp2025-011",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "转诊标准(五类人群)",
        "content": "基层高血压转诊五类人群：起病急、症状重、疑继发、难控制、孕产妇。初诊转诊条件：(1)血压≥180/110mmHg伴急性症状(剧烈头痛、呕吐、视力模糊、意识改变)；(2)怀疑继发性高血压(发病年龄<30岁无家族史、肌无力发作性软瘫、阵发性头痛心悸多汗)；(3)妊娠或哺乳期女性。随访转诊条件：规范治疗3个月血压仍不达标；血压明显波动难以控制；出现新的靶器官损害或原有损害加重。",
        "evidence_level": "A",
        "tags": ["高血压", "转诊", "急症", "继发性高血压", "妊娠高血压", "难治性"]
    },
    {
        "id": "bp2025-012",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "家庭血压监测指导",
        "content": "推荐使用经准确度验证的上臂式电子血压计进行家庭血压监测。测量方案：早晚各测量1次，每次2-3遍。早上在起床后排空膀胱、服药前和早饭前坐位测量；晚上在晚饭后、睡觉前坐位测量。建议连续测量5-7天，取所有测量值的平均值评估血压控制情况。家庭血压≥135/85mmHg即为血压未控制。家庭血压监测有助于发现白大衣高血压和隐蔽性高血压，提高患者依从性。",
        "evidence_level": "A",
        "tags": ["高血压", "家庭血压", "自测血压", "血压计", "监测方案", "白大衣高血压"]
    },
    {
        "id": "bp2025-013",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "高血压初诊评估内容",
        "content": "初诊评估目的：评估心血管疾病发病风险、靶器官损害及并存临床情况。病史：确诊时间、用药史及耐受性；既往糖尿病、脑卒中、冠心病、心力衰竭、心房颤动、慢性肾病等合并症；打鼾伴呼吸暂停、肌无力等继发性高血压症状；家族史(高血压、糖尿病、血脂异常、早发心血管病)；吸烟饮酒史。体格检查：血压、心率、身高、体重、腰围、血管杂音、足背动脉搏动、双下肢水肿。辅助检查：血常规、尿常规、血肌酐、血尿酸、转氨酶、血钾钠氯、血糖、血脂、心电图。",
        "evidence_level": "B",
        "tags": ["高血压", "初诊", "评估", "检查", "心血管风险", "靶器官损害"]
    },
    {
        "id": "bp2025-014",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "高血压流行病学与危害",
        "content": "我国高血压患病人数已达2.45亿。高血压严重并发症(脑卒中、冠心病、心力衰竭、慢性肾脏病等)的致残率和致死率较高。研究表明，在血压不低于115/75mmHg的范围内，收缩压每降低10mmHg或舒张压每降低5mmHg，死亡风险降低10%-15%，脑卒中风险降低35%，冠心病风险降低20%，心力衰竭风险降低40%。高血压可防可控，预防和控制高血压是遏制心脑血管疾病流行的核心策略。",
        "evidence_level": "A",
        "tags": ["高血压", "流行病学", "患病率", "并发症", "降压获益", "心脑血管"]
    },
    {
        "id": "bp2025-015",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "高血压筛查与预防",
        "content": "筛查对象：≥18岁成年人首诊均应测量血压。高危人群(血压正常高值、超重/肥胖、高血压家族史、长期高盐饮食、长期过量饮酒者)建议至少每半年测量1次血压。预防措施：全人群策略——推广健康生活方式(减盐、控制体重、适量运动、限酒、心理健康)；高危人群策略——针对性干预，定期监测血压，必要时药物干预。正常高值血压人群应积极改善生活方式，每年至少测量1次血压。",
        "evidence_level": "B",
        "tags": ["高血压", "筛查", "预防", "高危人群", "正常高值", "健康管理"]
    },
    {
        "id": "bp2025-016",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "常用降压药物具体推荐(2025版)",
        "content": "CCB(钙拮抗剂)：氨氯地平5-10mg每日1次，硝苯地平控释片30-60mg每日1次。ARB：缬沙坦80-160mg每日1次，氯沙坦50-100mg每日1次，厄贝沙坦150-300mg每日1次。ACEI：贝那普利10-20mg每日1次，依那普利10-20mg每日1次。利尿剂：氢氯噻嗪12.5-25mg每日1次，吲达帕胺1.5mg每日1次。β受体阻滞剂：美托洛尔缓释片47.5-95mg每日1次，比索洛尔5-10mg每日1次。ARNI：沙库巴曲缬沙坦(条件允许时可用于合并心力衰竭的高血压)。",
        "evidence_level": "A",
        "tags": ["高血压", "药物剂量", "氨氯地平", "缬沙坦", "氢氯噻嗪", "美托洛尔", "ARNI"]
    },
    {
        "id": "bp2025-017",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "中医药在高血压管理中的应用",
        "content": "基层医疗卫生机构应积极应用中医药及特色适宜技术辅助降压。中医辨证分型治疗可作为降压药物治疗的补充。常用方法包括：中药方剂辨证施治、针灸(百会、曲池、足三里等穴位)、太极拳/八段锦等传统运动疗法。中医药治疗高血压强调整体调理、改善症状、提高生活质量，但不能替代规范的降压药物治疗。",
        "evidence_level": "C",
        "tags": ["高血压", "中医药", "辅助治疗", "针灸", "太极拳", "辨证施治"]
    },
    {
        "id": "bp2025-018",
        "source": SOURCE,
        "condition": CONDITION,
        "title": "高血压健康教育要点",
        "content": "健康教育核心信息：(1)高血压是最常见的慢性病，可导致脑卒中、心脏病和肾脏病等严重并发症；(2)定期测量血压是早期发现高血压的唯一方法；(3)高血压可防可控，降压治疗可有效降低并发症风险；(4)高血压需要长期规律服药，不能自行停药或减药；(5)健康生活方式是高血压防治的基础，与药物治疗缺一不可；(6)家庭自测血压有助于监测降压效果和提高治疗依从性；(7)出现头痛加重、视力模糊、胸闷气短等症状应及时就医。",
        "evidence_level": "B",
        "tags": ["高血压", "健康教育", "患者宣教", "依从性", "自我管理"]
    }
]

# Load existing guidelines
guidelines_path = r'C:\Users\86177\Projects\evidence-family-doctor\data\processed\guidelines.json'
with open(guidelines_path, 'r', encoding='utf-8') as f:
    existing = json.load(f)

# Remove old hypertension entries (they'll be replaced by the new ones)
non_bp = [e for e in existing if e['condition'] != '高血压']
print(f"Existing entries: {len(existing)} total, {len(existing) - len(non_bp)} hypertension (removing)")
print(f"New hypertension entries: {len(entries)}")

# Combine: keep non-BP entries + add new BP entries
final = entries + non_bp
print(f"Final knowledge base: {len(final)} entries")

# Save
with open(guidelines_path, 'w', encoding='utf-8') as f:
    json.dump(final, f, ensure_ascii=False, indent=2)

print(f"\nSaved to {guidelines_path}")
print("Done!")
