import re
html_file = 'Guia_de_Estudio.html'
with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()
print('Selector found:', '<div class="exam-selector">' in content)
print('exam3 found:', 'id="exam3"' in content)
