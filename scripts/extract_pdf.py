import fitz
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

doc = fitz.open(r'D:\Project\summer-internship\01-基本信息\1759482019584069121.pdf')
full_text = ''
for i in range(doc.page_count):
    full_text += doc[i].get_text()
    full_text += '\n\n'

output_path = r'C:\Users\86177\Projects\evidence-family-doctor\data\raw_guideline_2025.txt'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(full_text)

print(f'Extracted {len(full_text)} chars from {doc.page_count} pages')
print(f'Saved to {output_path}')
