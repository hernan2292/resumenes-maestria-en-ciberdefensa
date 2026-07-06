# -*- coding: utf-8 -*-
import re

html_file = 'Guia_de_Estudio.html'
with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject Styles
css_to_add = """
        /* Toggle button for solutions */
        .btn-sol-toggle {
            background: rgba(99, 102, 241, 0.1);
            color: var(--primary);
            border: 1px solid rgba(99, 102, 241, 0.25);
            padding: 0.5rem 1rem;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
            font-family: 'Outfit', sans-serif;
            margin-top: 0.5rem;
            margin-bottom: 0.5rem;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            outline: none;
        }

        .btn-sol-toggle:hover {
            background: var(--primary);
            color: white;
            box-shadow: 0 0 15px var(--primary-glow);
            transform: translateY(-1px);
        }

        .btn-sol-toggle.active {
            background: rgba(16, 185, 129, 0.1);
            color: var(--secondary);
            border-color: rgba(16, 185, 129, 0.25);
        }

        .btn-sol-toggle.active:hover {
            background: var(--secondary);
            color: white;
            box-shadow: 0 0 15px var(--secondary-glow);
        }

        /* Hide solutions by default */
        .question-body {
            display: none;
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px dashed rgba(255, 255, 255, 0.08);
        }

        .question-body.active {
            display: block;
            animation: fadeInSol 0.3s ease-out;
        }

        @keyframes fadeInSol {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
"""

content = content.replace('</style>', css_to_add + '\n    </style>')

# 2. Inject JS function
js_to_add = """
        // Toggle individual question solution
        function toggleSolution(btn) {
            const questionBox = btn.closest('.question-box');
            if (!questionBox) return;
            const body = questionBox.querySelector('.question-body');
            if (body) {
                body.classList.toggle('active');
                if (body.classList.contains('active')) {
                    btn.innerHTML = 'Ocultar resolución';
                    btn.classList.add('active');
                } else {
                    btn.innerHTML = 'Ver resolución';
                    btn.classList.remove('active');
                }
            }
        }
"""

last_script_idx = content.rfind('</script>')
if last_script_idx != -1:
    content = content[:last_script_idx] + js_to_add + content[last_script_idx:]

# 3. Insert toggle buttons before question-body divs
# We use regex to find all <div class="question-body"> and insert the button before it
# We capture any potential spaces/indentation before <div class="question-body"> to match formatting
content = re.sub(
    r'(\s*)(<div class="question-body">)',
    r'\1<button class="btn-sol-toggle" onclick="toggleSolution(this)">Ver resolución</button>\n\1\2',
    content
)

with open(html_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Toggles injected successfully using Regex!")
