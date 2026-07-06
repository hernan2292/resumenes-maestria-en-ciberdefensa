# -*- coding: utf-8 -*-
import zipfile
import xml.etree.ElementTree as ET

filepath = r'c:\Users\herna\OneDrive\proyects\resumenes-maestria-en-ciberdefensa\Matematica aplicada a la Criptografia\Examenes\Examen Mate Cripto 300625 - con explicacion en clase.docx'

z = zipfile.ZipFile(filepath)
xml_content = z.read('word/document.xml')
tree = ET.fromstring(xml_content)
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

paragraphs = []
for p in tree.iter('{' + ns + '}p'):
    texts = [node.text for node in p.iter('{' + ns + '}t') if node.text]
    if texts:
        paragraphs.append(''.join(texts))

print('\n'.join(paragraphs))
