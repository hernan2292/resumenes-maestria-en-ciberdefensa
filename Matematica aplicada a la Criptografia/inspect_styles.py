# -*- coding: utf-8 -*-
content = open('Guia_de_Estudio.html', 'r', encoding='utf-8').read()

exams_view_start = content.find('id="exams-view"')
calc_view_start = content.find('id="calc-view"')

import re
pos = 0
matches = re.finditer(r'<div[^>]*class="[^"]*question-body[^"]*"', content)
outside = []
for i, m in enumerate(matches):
    idx = m.start()
    is_inside = exams_view_start <= idx <= calc_view_start
    if not is_inside:
        outside.append((i+1, idx))

print("Outside exams-view:", len(outside), outside)
