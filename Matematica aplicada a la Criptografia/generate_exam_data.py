# -*- coding: utf-8 -*-
"""
Ajustar datos para que todo funcione correctamente.
"""
import math
from sympy import isprime, factorint, gcd, is_primitive_root

def extended_gcd(a, b):
    if b == 0:
        return a, 1, 0
    g, x1, y1 = extended_gcd(b, a % b)
    return g, y1, x1 - (a // b) * y1

def euclid_steps(a, b):
    """Show step-by-step Euclidean algorithm"""
    steps = []
    while b != 0:
        q, r = divmod(a, b)
        steps.append((a, b, q, r))
        a, b = b, r
    return steps, a

print("=" * 60)
print("EXAMEN PRÁCTICA A - CORREGIDO")
print("=" * 60)

# --- EJ 1: Factorización ---
# Primos cercanos para Fermat que funcionen en pocos pasos
p_A = 1301; q_A = 1319
n_core_A = p_A * q_A
# Multiplicar por 11 y 13
big_A = 11 * 13 * n_core_A  # = 245390717
print(f"\nEj1: Factorizar {big_A:,}")
print(f"  {big_A} = 11 * 13 * {n_core_A}")
print(f"  Fermat en {n_core_A}:")
x_start = math.isqrt(n_core_A)
if x_start * x_start < n_core_A: x_start += 1
for x in range(x_start, x_start + 10):
    y2 = x*x - n_core_A
    y = math.isqrt(y2)
    is_sq = y*y == y2
    print(f"    x={x}: x²-n={y2}, √={y:.0f}, cuadrado={is_sq}")
    if is_sq:
        print(f"    => {x}-{y}={x-y}, {x}+{y}={x+y}")
        break
print(f"  Primalidad: {p_A} primo={isprime(p_A)}, {q_A} primo={isprime(q_A)}")
print(f"  Probar primos hasta √{p_A}≈{math.isqrt(p_A)}, √{q_A}≈{math.isqrt(q_A)}")

# --- EJ 2a: Raíz primitiva ---
# Buscar g que NO sea RP (como el examen original con 19 mod 241)
p_rp_A = 181
phi_A = 180
pf_A = [2, 3, 5]
print(f"\nEj2a: ¿Es 10 raíz primitiva módulo {p_rp_A}?")
print(f"  φ({p_rp_A}) = {phi_A} = 2² × 3² × 5")
print(f"  Factores primos de φ: {pf_A}")

# 10 SÍ es RP mod 181, busquemos uno que NO lo sea
for g in range(2, 50):
    if not is_primitive_root(g, p_rp_A):
        # Verificar cuál lo atrapa
        for q in pf_A:
            if pow(g, phi_A // q, p_rp_A) == 1:
                print(f"  Candidato g={g}: NO es RP mod {p_rp_A}")
                print(f"    {g}^({phi_A}/{q}) = {g}^{phi_A//q} mod {p_rp_A} = {pow(g, phi_A//q, p_rp_A)} = 1 ← falla!")
                for q2 in pf_A:
                    print(f"    {g}^{phi_A//q2} mod {p_rp_A} = {pow(g, phi_A//q2, p_rp_A)}")
                break
        break

# Usar g=4 que NO es RP mod 181
g_A = 4
print(f"\n  Usando g={g_A}:")
for q in pf_A:
    exp = phi_A // q
    result = pow(g_A, exp, p_rp_A)
    print(f"    {g_A}^({phi_A}/{q}) = {g_A}^{exp} mod {p_rp_A} = {result}")

# --- EJ 2b: Potencia modular ---
base_A = 13; exp_A = 987654; mod_A = 197
phi_mod_A = 196
q_div, r_div = divmod(exp_A, phi_mod_A)
print(f"\nEj2b: {base_A}^{exp_A} mod {mod_A}")
print(f"  PTF: {base_A}^{phi_mod_A} ≡ 1 (mod {mod_A})")
print(f"  {exp_A} = {q_div} × {phi_mod_A} + {r_div}")
print(f"  {base_A}^{r_div} mod {mod_A} = {pow(base_A, r_div, mod_A)}")

# Paso a paso de 13^10 mod 197
print(f"  Desarrollo paso a paso de {base_A}^{r_div} mod {mod_A}:")
# 13^1 = 13
# 13^2 = 169
# 13^4 = 169^2 = 28561 mod 197
# 13^8 = ...
# 13^10 = 13^8 * 13^2
val = base_A
powers = {1: base_A % mod_A}
p = 1
while p * 2 <= r_div:
    val = (val * val) % mod_A
    p *= 2
    powers[p] = val
    print(f"    {base_A}^{p} = {val} (mod {mod_A})")

# Decompose r_div in binary
result = 1
bits = []
temp = r_div
while temp > 0:
    bit = 1
    while bit * 2 <= temp:
        bit *= 2
    bits.append(bit)
    temp -= bit
print(f"    {r_div} = {' + '.join(map(str, bits))}")
for bit in bits:
    result = (result * powers[bit]) % mod_A
print(f"    {base_A}^{r_div} = {'×'.join([str(powers[b]) for b in bits])} mod {mod_A} = {pow(base_A, r_div, mod_A)}")

# --- EJ 4: Ecuaciones Diofánticas ---
# a) Con solución
a1, b1, c1 = 780, 468, 78
d1 = gcd(a1, b1)
print(f"\nEj4a: {a1}X + {b1}Y = {c1}")
print(f"  MCD({a1}, {b1}) = {d1}")
print(f"  {d1} divide a {c1}? {c1 % d1 == 0}")

steps, gcd_val = euclid_steps(a1, b1)
print(f"  Pasos Euclides:")
for s in steps:
    print(f"    {s[0]} = {s[1]} × {s[2]} + {s[3]}")

d, x0, y0 = extended_gcd(a1, b1)
factor = c1 // d
x0s = x0 * factor; y0s = y0 * factor
print(f"  Bézout: {a1}×({x0}) + {b1}×({y0}) = {d}")
print(f"  Particular para {c1}: X0={x0s}, Y0={y0s}")
print(f"  Verificación: {a1}×{x0s} + {b1}×{y0s} = {a1*x0s + b1*y0s}")

bd = b1 // d; ad = a1 // d
print(f"  General: X = {x0s} + {bd}t, Y = {y0s} - {ad}t")
print(f"  X<200: {x0s}+{bd}t < 200 → t < {(200-x0s)/bd:.4f}")
print(f"  Y<-200: {y0s}-{ad}t < -200 → t > {(y0s+200)/ad:.4f}")
for t in range(-10, 30):
    xv = x0s + bd*t; yv = y0s - ad*t
    if xv < 200 and yv < -200:
        print(f"    t={t}: X={xv}, Y={yv}")
        print(f"    Verif: {a1}×{xv} + {b1}×{yv} = {a1*xv + b1*yv}")

# b) Sin solución
a2, b2, c2 = 780, 420, 50
d2 = gcd(a2, b2)
print(f"\nEj4b: {a2}X + {b2}Y = {c2}")
print(f"  MCD({a2}, {b2}) = {d2}")
print(f"  {d2} divide a {c2}? {c2 % d2 == 0}")
steps2, _ = euclid_steps(a2, b2)
print(f"  Pasos Euclides:")
for s in steps2:
    print(f"    {s[0]} = {s[1]} × {s[2]} + {s[3]}")

print("\n" + "=" * 60)
print("EXAMEN PRÁCTICA B - FINAL")
print("=" * 60)

# --- EJ 1 ---
p_B = 1427; q_B = 1433
n_core_B = p_B * q_B
big_B = 7 * 13 * n_core_B  # 186085081
print(f"\nEj1: Factorizar {big_B:,}")
print(f"  {big_B} = 7 × 13 × {n_core_B}")
x_start_B = math.isqrt(n_core_B)
if x_start_B * x_start_B < n_core_B: x_start_B += 1
for x in range(x_start_B, x_start_B + 10):
    y2 = x*x - n_core_B
    y = math.isqrt(y2)
    is_sq = y*y == y2
    print(f"    x={x}: x²-n={y2}, √={y:.0f}, cuadrado={is_sq}")
    if is_sq:
        print(f"    => {x}-{y}={x-y}, {x}+{y}={x+y}")
        break

# --- EJ 2a ---
p_rp_B = 199; phi_B = 198; g_B = 7
pf_B = [2, 3, 11]
print(f"\nEj2a: ¿Es {g_B} raíz primitiva módulo {p_rp_B}?")
print(f"  φ({p_rp_B}) = {phi_B} = 2 × 3² × 11")
print(f"  {g_B} es RP mod {p_rp_B}: {is_primitive_root(g_B, p_rp_B)}")
for q in pf_B:
    exp = phi_B // q
    result = pow(g_B, exp, p_rp_B)
    print(f"    {g_B}^({phi_B}/{q}) = {g_B}^{exp} mod {p_rp_B} = {result}")

# --- EJ 2b ---
base_B = 17; exp_B = 853792; mod_B = 211
phi_B2 = 210
q_B2, r_B2 = divmod(exp_B, phi_B2)
print(f"\nEj2b: {base_B}^{exp_B} mod {mod_B}")
print(f"  {exp_B} = {q_B2} × {phi_B2} + {r_B2}")
print(f"  {base_B}^{r_B2} mod {mod_B} = {pow(base_B, r_B2, mod_B)}")

# Paso a paso 17^142 mod 211
print(f"  Desarrollo paso a paso:")
val = base_B
powers_B = {1: base_B % mod_B}
p2 = 1
while p2 * 2 <= r_B2:
    val = (val * val) % mod_B
    p2 *= 2
    powers_B[p2] = val
    print(f"    {base_B}^{p2} = {val} (mod {mod_B})")

temp = r_B2
bits_B = []
while temp > 0:
    bit = 1
    while bit * 2 <= temp:
        bit *= 2
    bits_B.append(bit)
    temp -= bit
print(f"    {r_B2} = {' + '.join(map(str, bits_B))}")
result_B = 1
for bit in bits_B:
    result_B = (result_B * powers_B[bit]) % mod_B
print(f"    Resultado: {pow(base_B, r_B2, mod_B)}")

# --- EJ 4 ---
a1B, b1B, c1B = 756, 420, 84
d1B = gcd(a1B, b1B)
print(f"\nEj4a: {a1B}X + {b1B}Y = {c1B}")
print(f"  MCD = {d1B}, divide a {c1B}? {c1B % d1B == 0}")
steps_B, _ = euclid_steps(a1B, b1B)
for s in steps_B:
    print(f"    {s[0]} = {s[1]} × {s[2]} + {s[3]}")

d, x0, y0 = extended_gcd(a1B, b1B)
factor = c1B // d
x0s = x0 * factor; y0s = y0 * factor
print(f"  Particular: X0={x0s}, Y0={y0s}")
print(f"  Verif: {a1B*x0s + b1B*y0s}")
bd = b1B // d; ad = a1B // d
print(f"  General: X = {x0s} + {bd}t, Y = {y0s} - {ad}t")
for t in range(-5, 50):
    xv = x0s + bd*t; yv = y0s - ad*t
    if xv < 200 and yv < -200:
        print(f"    t={t}: X={xv}, Y={yv}, Verif={a1B*xv + b1B*yv}")

a2B, b2B, c2B = 756, 540, 50
d2B = gcd(a2B, b2B)
print(f"\nEj4b: {a2B}X + {b2B}Y = {c2B}")
print(f"  MCD = {d2B}, divide a {c2B}? {c2B % d2B == 0}")

print("\n¡Datos verificados!")
