"""
Generate Geometry Chapter Notes PDF — Handwritten Style
Output: docs/geometry_notes_handwritten.pdf
"""
import os
import math
import random
import tempfile

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Arc, FancyArrowPatch
import numpy as np

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, black, white
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

random.seed(42)
np.random.seed(42)

TMPDIR = tempfile.mkdtemp(prefix="geom_")
PAGE_W, PAGE_H = A4
MARGIN_L = 25 * mm
MARGIN_R = 20 * mm
MARGIN_T = 20 * mm
MARGIN_B = 20 * mm
LINE_SPACING = 7.2 * mm
NOTEBOOK_LINE = HexColor("#a8c8e8")
MARGIN_LINE = HexColor("#e8a0a0")
PAPER_COLOR = HexColor("#fefcf5")
INK_COLOR = HexColor("#1a1a2e")
HIGHLIGHT_COLOR = HexColor("#fff3a0")
HEADING_COLOR = HexColor("#2c3e80")
ACCENT_COLOR = HexColor("#c0392b")

FONTS_DIR = os.environ.get("GEOM_FONTS_DIR", r"C:\Users\mahic\AppData\Local\Temp\opencode")
CAVEAT = os.path.join(FONTS_DIR, "Caveat.ttf")
KALAM = os.path.join(FONTS_DIR, "Kalam.ttf")

pdfmetrics.registerFont(TTFont("Hand", CAVEAT))
pdfmetrics.registerFont(TTFont("HandBold", CAVEAT))
pdfmetrics.registerFont(TTFont("Body", KALAM))


def hand_jitter(x, y, amt=0.15):
    return x + random.uniform(-amt, amt), y + random.uniform(-amt, amt)


def draw_lined_paper(c):
    c.setFillColor(PAPER_COLOR)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setStrokeColor(NOTEBOOK_LINE)
    c.setLineWidth(0.5)
    y = PAGE_H - MARGIN_T
    while y > MARGIN_B:
        c.line(MARGIN_L, y, PAGE_W - MARGIN_R, y)
        y -= LINE_SPACING
    c.setStrokeColor(MARGIN_LINE)
    c.setLineWidth(1.2)
    c.line(MARGIN_L + 12 * mm, MARGIN_T - 5 * mm, MARGIN_L + 12 * mm, PAGE_H - MARGIN_B + 5 * mm)


def fig_save(fig, name):
    path = os.path.join(TMPDIR, name)
    fig.savefig(path, dpi=150, bbox_inches="tight", facecolor="white", pad_inches=0.1)
    plt.close(fig)
    return path


def make_triangle_types():
    fig, axes = plt.subplots(1, 4, figsize=(10, 2.6))
    titles = ["Equilateral", "Isosceles", "Scalene", "Right-Angled"]
    for ax, title in zip(axes, titles):
        ax.set_aspect("equal")
        ax.axis("off")
        ax.set_xlim(-0.5, 2.5)
        ax.set_ylim(-0.5, 2.2)
        if title == "Equilateral":
            pts = np.array([[0, 0], [2, 0], [1, math.sqrt(3)]])
        elif title == "Isosceles":
            pts = np.array([[0, 0], [2, 0], [1, 1.8]])
        elif title == "Scalene":
            pts = np.array([[0, 0], [2.2, 0], [0.7, 1.5]])
        else:
            pts = np.array([[0, 0], [2, 0], [0, 1.4]])
        poly = patches.Polygon(pts, closed=True, fill=True, facecolor="#d6eaf8",
                               edgecolor="#2c3e80", linewidth=1.5)
        ax.add_patch(poly)
        for i, p in enumerate(pts):
            ax.plot(*p, 'ko', markersize=3)
        cx, cy = pts.mean(axis=0)
        ax.annotate(title, (cx, cy), fontsize=7, ha="center", va="center",
                    style="italic", color="#c0392b", fontweight="bold")
        side = 0.22
        if title == "Right-Angled":
            ax.plot([0, side], [side, side], 'k-', lw=0.8)
            ax.plot([side, side], [0, side], 'k-', lw=0.8)
    fig.tight_layout()
    return fig_save(fig, "triangle_types.png")


def make_angles():
    fig, axes = plt.subplots(1, 4, figsize=(10, 2.4))
    for ax, (label, angle) in zip(axes, [("Acute", 45), ("Right", 90), ("Obtuse", 135), ("Straight", 180)]):
        ax.set_aspect("equal")
        ax.axis("off")
        ax.set_xlim(-1.3, 1.3)
        ax.set_ylim(-1.1, 1.1)
        ax.annotate("", xy=(1, 0), xytext=(0, 0),
                    arrowprops=dict(arrowstyle="->", color="#2c3e80", lw=1.5))
        rad = math.radians(angle)
        ax.annotate("", xy=(math.cos(rad), math.sin(rad)), xytext=(0, 0),
                    arrowprops=dict(arrowstyle="->", color="#c0392b", lw=1.5))
        if angle < 180:
            arc = Arc((0, 0), 0.6, 0.6, angle=0, theta1=0, theta2=angle, color="#e67e22", lw=1.2)
            ax.add_patch(arc)
        if angle == 90:
            ax.plot([0.2, 0.2, 0], [0, 0.2, 0.2], 'k-', lw=0.8)
        ax.set_title(f"{label} ({angle}°)", fontsize=8, color="#2c3e80", fontweight="bold", pad=4)
    fig.tight_layout()
    return fig_save(fig, "angles.png")


def make_circle_parts():
    fig, ax = plt.subplots(figsize=(4, 4))
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_xlim(-1.6, 1.6)
    ax.set_ylim(-1.6, 1.6)
    circ = patches.Circle((0, 0), 1, fill=False, edgecolor="#2c3e80", linewidth=1.8)
    ax.add_patch(circ)
    ax.plot(0, 0, 'ko', markersize=4)
    ax.annotate("O (center)", (0, 0), xytext=(0.4, -0.35), fontsize=8, color="#c0392b",
                arrowprops=dict(arrowstyle="->", color="#c0392b", lw=0.8))
    ax.plot([0, 0.866], [0, 0.5], 'g-', lw=1.5)
    ax.annotate("r", (0.35, 0.05), fontsize=9, color="green", fontweight="bold")
    ax.plot([0.5, -0.7], [0.866, -0.5], 'b-', lw=1.2)
    ax.annotate("chord", (-0.1, 0.35), fontsize=7.5, color="#2c3e80", rotation=38)
    ax.plot([-0.7, -0.7], [-0.5, -1.35], 'r--', lw=1.2)
    ax.annotate("tangent", (-0.7, -1.1), fontsize=7.5, color="#c0392b", ha="center")
    ax.set_title("Circle — Key Parts", fontsize=10, color="#2c3e80", fontweight="bold")
    fig.tight_layout()
    return fig_save(fig, "circle_parts.png")


def make_quadrilaterals():
    fig, axes = plt.subplots(1, 5, figsize=(11, 2.4))
    titles = ["Square", "Rectangle", "Parallelogram", "Rhombus", "Trapezium"]
    for ax, title in zip(axes, titles):
        ax.set_aspect("equal")
        ax.axis("off")
        ax.set_xlim(-0.4, 2.4)
        ax.set_ylim(-0.4, 2.0)
        if title == "Square":
            pts = np.array([[0, 0], [1.6, 0], [1.6, 1.6], [0, 1.6]])
        elif title == "Rectangle":
            pts = np.array([[0, 0], [2.0, 0], [2.0, 1.2], [0, 1.2]])
        elif title == "Parallelogram":
            pts = np.array([[0, 0], [1.8, 0], [2.2, 1.3], [0.4, 1.3]])
        elif title == "Rhombus":
            pts = np.array([[0.8, 0], [1.6, 1.0], [0.8, 2.0], [0, 1.0]])
        else:
            pts = np.array([[0.3, 0], [1.9, 0], [1.5, 1.3], [0.6, 1.3]])
        poly = patches.Polygon(pts, closed=True, fill=True, facecolor="#e8f8f5",
                               edgecolor="#2c3e80", linewidth=1.5)
        ax.add_patch(poly)
        cx, cy = pts.mean(axis=0)
        ax.annotate(title, (cx, cy), fontsize=7, ha="center", va="center",
                    style="italic", color="#c0392b", fontweight="bold")
    fig.tight_layout()
    return fig_save(fig, "quadrilaterals.png")


def make_congruence():
    fig, axes = plt.subplots(1, 4, figsize=(9, 2.4))
    labels = ["SSS", "SAS", "ASA", "RHS"]
    for ax, label in zip(axes, labels):
        ax.set_aspect("equal")
        ax.axis("off")
        ax.set_xlim(-0.4, 2.4)
        ax.set_ylim(-0.4, 2.0)
        if label == "RHS":
            pts = np.array([[0, 0], [1.6, 0], [0, 1.3]])
            ax.plot([0.18, 0.18, 0], [0, 0.18, 0.18], 'k-', lw=0.7)
        else:
            pts = np.array([[0, 0], [1.8, 0], [0.9, 1.4]])
        poly = patches.Polygon(pts, closed=True, fill=True, facecolor="#fdebd0",
                               edgecolor="#2c3e80", linewidth=1.5)
        ax.add_patch(poly)
        for i in range(3):
            p1, p2 = pts[i], pts[(i + 1) % 3]
            mid = (p1 + p2) / 2
            ax.annotate(f"s{i+1}", mid, fontsize=7, color="#c0392b",
                        ha="center", va="center", fontweight="bold")
        ax.set_title(f"{label} Rule", fontsize=8.5, color="#2c3e80", fontweight="bold", pad=3)
    fig.tight_layout()
    return fig_save(fig, "congruence.png")


def make_pythagoras():
    fig, ax = plt.subplots(figsize=(3.8, 3.5))
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_xlim(-0.5, 3.5)
    ax.set_ylim(-0.5, 3.5)
    tri = patches.Polygon([[0, 0], [3, 0], [0, 2.2]], closed=True, fill=True,
                          facecolor="#d6eaf8", edgecolor="#2c3e80", linewidth=1.8)
    ax.add_patch(tri)
    ax.plot([0.22, 0.22, 0], [0, 0.22, 0.22], 'k-', lw=0.9)
    ax.annotate("a", (1.4, -0.25), fontsize=10, color="#c0392b", fontweight="bold")
    ax.annotate("b", (-0.3, 1.0), fontsize=10, color="#c0392b", fontweight="bold")
    ax.annotate("c", (1.2, 1.05), fontsize=10, color="#c0392b", fontweight="bold")
    ax.annotate("90°", (0.3, 0.3), fontsize=8, color="#e67e22")
    ax.annotate("a² + b² = c²", (1.5, 2.8), fontsize=11, color="#2c3e80",
                fontweight="bold", ha="center",
                bbox=dict(boxstyle="round,pad=0.3", fc="#fff3a0", ec="#e67e22", lw=0.8))
    fig.tight_layout()
    return fig_save(fig, "pythagoras.png")


def make_coordinate():
    fig, ax = plt.subplots(figsize=(4.5, 4))
    ax.set_aspect("equal")
    ax.set_xlim(-3, 5)
    ax.set_ylim(-3, 5)
    ax.axhline(0, color="#555", lw=0.8)
    ax.axvline(0, color="#555", lw=0.8)
    for i in range(-2, 5):
        ax.plot(i, 0, 'k|', markersize=5)
        ax.plot(0, i, 'k_', markersize=5)
    A, B = np.array([1, 1]), np.array([4, 4])
    ax.plot(*A, 'ro', markersize=5)
    ax.plot(*B, 'bo', markersize=5)
    ax.annotate("A(1, 1)", A, xytext=(0.3, 0.1), fontsize=8, color="#c0392b")
    ax.annotate("B(4, 4)", B, xytext=(-1.2, 0.4), fontsize=8, color="#2c3e80")
    ax.plot([A[0], B[0]], [A[1], B[1]], 'g--', lw=1.5)
    mid = (A + B) / 2
    ax.annotate("d = √[(x₂-x₁)² + (y₂-y₁)²]", (mid[0] - 0.2, mid[1] - 0.8),
                fontsize=8, color="#2c3e80",
                bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="#2c3e80", lw=0.6))
    ax.set_xlabel("x", fontsize=9)
    ax.set_ylabel("y", fontsize=9)
    ax.set_title("Coordinate Geometry", fontsize=10, color="#2c3e80", fontweight="bold")
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    fig.tight_layout()
    return fig_save(fig, "coordinate.png")


def make_theorems():
    fig, axes = plt.subplots(1, 3, figsize=(9, 2.8))
    # Thales
    ax = axes[0]
    ax.set_aspect("equal"); ax.axis("off"); ax.set_xlim(-1.5, 1.5); ax.set_ylim(-1.4, 1.4)
    circ = patches.Circle((0, 0), 1, fill=False, edgecolor="#2c3e80", lw=1.5)
    ax.add_patch(circ)
    pts = np.array([[-0.866, -0.5], [0.866, -0.5], [0, 1]])
    ax.plot(*np.vstack([pts, pts[0]]).T, 'b-', lw=1.3)
    ax.plot([-0.866, 0.866], [-0.5, -0.5], 'g--', lw=1.2)
    ax.annotate("Thales: ∠ = 90°", (0, -1.25), fontsize=8, ha="center", color="#c0392b",
                fontweight="bold")
    # Exterior angle
    ax = axes[1]
    ax.set_aspect("equal"); ax.axis("off"); ax.set_xlim(-0.5, 3.5); ax.set_ylim(-0.8, 2.2)
    pts = np.array([[0, 0], [2.5, 0], [0.6, 1.5]])
    ax.plot(*np.vstack([pts, pts[0]]).T, 'b-', lw=1.4)
    ax.plot([2.5, 3.3], [0, 0], 'r--', lw=1.2)
    ax.annotate("ext ∠ = sum of opp int ∠s", (1.2, 1.9), fontsize=8, ha="center",
                color="#c0392b", fontweight="bold")
    # Angle sum
    ax = axes[2]
    ax.set_aspect("equal"); ax.axis("off"); ax.set_xlim(-0.5, 3); ax.set_ylim(-0.5, 2)
    pts = np.array([[0, 0], [2.5, 0], [0.8, 1.6]])
    poly = patches.Polygon(pts, closed=True, fill=True, facecolor="#fdebd0",
                           edgecolor="#2c3e80", lw=1.4)
    ax.add_patch(poly)
    for p, lbl in zip(pts, ["A", "B", "C"]):
        ax.annotate(lbl, p + 0.12, fontsize=8, color="#2c3e80")
    ax.annotate("∠A + ∠B + ∠C = 180°", (1.0, 0.6), fontsize=9, ha="center",
                color="#c0392b", fontweight="bold")
    fig.tight_layout()
    return fig_save(fig, "theorems.png")


def make_3d_shapes():
    fig, axes = plt.subplots(1, 4, figsize=(10, 2.8))
    titles = ["Cone", "Sphere", "Cylinder", "Cube"]
    for ax, title in zip(axes, titles):
        ax.set_aspect("equal")
        ax.axis("off")
        ax.set_xlim(-0.6, 2.4)
        ax.set_ylim(-0.6, 2.2)
        if title == "Cone":
            from matplotlib.patches import Polygon
            pts = np.array([[0.5, 1.8], [-0.3, 0], [1.3, 0]])
            poly = Polygon(pts, closed=True, fill=True, facecolor="#d6eaf8", edgecolor="#2c3e80", lw=1.5)
            ax.add_patch(poly)
            ax.plot([0.5, 0.5], [1.8, 0], 'r--', lw=1)
            ax.annotate("h", (0.55, 0.9), fontsize=8, color="#c0392b")
            ax.annotate("r", (0.5, -0.25), fontsize=8, color="green")
            ax.annotate("l", (1.05, 1.0), fontsize=8, color="#2c3e80")
        elif title == "Sphere":
            circ = patches.Circle((0.9, 1.0), 0.85, fill=True, facecolor="#d6eaf8",
                                  edgecolor="#2c3e80", lw=1.5)
            ax.add_patch(circ)
            circ2 = patches.Circle((0.9, 1.0), 0.85, fill=False, edgecolor="#2c3e80", lw=0.8, linestyle='--')
            ax.add_patch(circ2)
            ax.plot([0.9, 1.55], [1.0, 1.0], 'g-', lw=1.2)
            ax.annotate("r", (1.1, 0.85), fontsize=8, color="green")
        elif title == "Cylinder":
            from matplotlib.patches import Ellipse, Rectangle
            body = Rectangle((0.2, 0.2), 1.4, 1.6, fill=True, facecolor="#d6eaf8",
                             edgecolor="#2c3e80", lw=1.5)
            ax.add_patch(body)
            top = Ellipse((0.9, 1.8), 1.4, 0.35, fill=True, facecolor="#e8f8f5",
                          edgecolor="#2c3e80", lw=1.5)
            ax.add_patch(top)
            bot = Ellipse((0.9, 0.2), 1.4, 0.35, fill=False, edgecolor="#2c3e80", lw=1.2, linestyle='--')
            ax.add_patch(bot)
            ax.annotate("h", (1.75, 1.0), fontsize=8, color="#c0392b")
            ax.annotate("r", (0.9, -0.15), fontsize=8, color="green")
        else:
            from matplotlib.patches import Rectangle
            front = Rectangle((0.2, 0.2), 1.4, 1.4, fill=True, facecolor="#d6eaf8",
                                 edgecolor="#2c3e80", lw=1.5)
            ax.add_patch(front)
            back = Rectangle((0.55, 0.55), 1.4, 1.4, fill=True, facecolor="#e8f8f5",
                              edgecolor="#2c3e80", lw=1.5)
            ax.add_patch(back)
            for sx, sy, ex, ey in [(0.2,0.2,0.55,0.55),(1.6,0.2,1.95,0.55),(0.2,1.6,0.55,1.95),(1.6,1.6,1.95,1.95)]:
                ax.plot([sx, ex], [sy, ey], 'k-', lw=1)
            ax.annotate("a", (0.9, 0.0), fontsize=9, ha="center", color="#c0392b")
        ax.set_title(title, fontsize=9, color="#2c3e80", fontweight="bold", pad=4)
    fig.tight_layout()
    return fig_save(fig, "3d_shapes.png")


def make_circle_theorems():
    fig, axes = plt.subplots(1, 3, figsize=(9, 2.8))
    # Angle in semicircle
    ax = axes[0]
    ax.set_aspect("equal"); ax.axis("off"); ax.set_xlim(-1.5, 1.5); ax.set_ylim(-1.2, 1.4)
    circ = patches.Circle((0, 0), 1, fill=False, edgecolor="#2c3e80", lw=1.5)
    ax.add_patch(circ)
    pts = np.array([[-1, 0], [1, 0], [0.3, 0.95]])
    ax.plot(*np.vstack([pts, pts[0]]).T, 'b-', lw=1.3)
    ax.plot([0.22, 0.22, 0], [0, 0.22, 0.22], 'k-', lw=0.7)
    ax.annotate("∠ in semicircle = 90°", (0, -1.1), fontsize=8, ha="center", color="#c0392b",
                fontweight="bold")
    # Perpendicular from center
    ax = axes[1]
    ax.set_aspect("equal"); ax.axis("off"); ax.set_xlim(-1.5, 1.5); ax.set_ylim(-1.2, 1.4)
    circ = patches.Circle((0, 0), 1, fill=False, edgecolor="#2c3e80", lw=1.5)
    ax.add_patch(circ)
    ax.plot([-0.6, 0.6], [0.8, 0.8], 'b-', lw=1.4)
    ax.plot([0, 0], [0, 0.8], 'r--', lw=1.2)
    ax.plot([0.15, 0.15, 0], [0.8, 0.65, 0.65], 'k-', lw=0.7)
    ax.annotate("⊥ from center bisects chord", (0, -1.1), fontsize=8, ha="center",
                color="#c0392b", fontweight="bold")
    # Equal chords
    ax = axes[2]
    ax.set_aspect("equal"); ax.axis("off"); ax.set_xlim(-1.5, 1.5); ax.set_ylim(-1.2, 1.4)
    circ = patches.Circle((0, 0), 1, fill=False, edgecolor="#2c3e80", lw=1.5)
    ax.add_patch(circ)
    ax.plot([-0.8, 0.4], [0.6, 0.6], 'b-', lw=1.4)
    ax.plot([-0.4, 0.8], [-0.6, -0.6], 'g-', lw=1.4)
    ax.plot([0, -0.2], [0, 0.6], 'r--', lw=1)
    ax.plot([0, 0.2], [0, -0.6], 'r--', lw=1)
    ax.annotate("equal chords ⟺ equidistant from center", (0, -1.1), fontsize=8,
                ha="center", color="#c0392b", fontweight="bold")
    fig.tight_layout()
    return fig_save(fig, "circle_theorems.png")


def make_areas_parallels():
    fig, axes = plt.subplots(1, 2, figsize=(7, 3))
    # Parallelogram & triangle between parallels
    ax = axes[0]
    ax.set_aspect("equal"); ax.axis("off"); ax.set_xlim(-0.4, 3); ax.set_ylim(-0.4, 2.2)
    ax.plot([0, 2.8], [0, 0], 'k-', lw=1.2)
    ax.plot([0, 2.8], [1.6, 1.6], 'k-', lw=1.2)
    para = patches.Polygon([[0.3, 0], [1.8, 0], [2.3, 1.6], [0.8, 1.6]], closed=True,
                           fill=True, facecolor="#d6eaf8", edgecolor="#2c3e80", lw=1.5)
    ax.add_patch(para)
    ax.annotate("Para = b × h", (1.3, 0.7), fontsize=9, ha="center", color="#c0392b",
                fontweight="bold")
    ax.annotate("h", (2.5, 0.8), fontsize=8, color="green")
    # Triangle
    ax = axes[1]
    ax.set_aspect("equal"); ax.axis("off"); ax.set_xlim(-0.4, 3); ax.set_ylim(-0.4, 2.2)
    ax.plot([0, 2.8], [0, 0], 'k-', lw=1.2)
    ax.plot([0, 2.8], [1.6, 1.6], 'k-', lw=1.2)
    tri = patches.Polygon([[0.3, 0], [2.2, 0], [1.2, 1.6]], closed=True,
                          fill=True, facecolor="#fdebd0", edgecolor="#2c3e80", lw=1.5)
    ax.add_patch(tri)
    ax.annotate("Δ = ½ × b × h", (1.2, 0.5), fontsize=9, ha="center", color="#c0392b",
                fontweight="bold")
    fig.tight_layout()
    return fig_save(fig, "areas_parallels.png")


def make_triangle_inequality():
    fig, axes = plt.subplots(1, 3, figsize=(9, 2.6))
    titles = ["a + b > c  ✓", "a + c > b  ✓", "b + c > a  ✓"]
    for ax, title in zip(axes, titles):
        ax.set_aspect("equal"); ax.axis("off"); ax.set_xlim(-0.4, 3); ax.set_ylim(-0.4, 2.2)
        pts = np.array([[0, 0], [2.4, 0], [1.0, 1.5]])
        poly = patches.Polygon(pts, closed=True, fill=True, facecolor="#e8f8f5",
                               edgecolor="#2c3e80", lw=1.5)
        ax.add_patch(poly)
        ax.annotate("a", (1.1, -0.25), fontsize=9, ha="center", color="#c0392b")
        ax.annotate("b", (0.35, 0.85), fontsize=9, color="#c0392b")
        ax.annotate("c", (1.75, 0.85), fontsize=9, color="#c0392b")
        ax.set_title(title, fontsize=8, color="#2c3e80", fontweight="bold", pad=3)
    fig.tight_layout()
    return fig_save(fig, "triangle_inequality.png")


def wrap_text(text, font, size, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if pdfmetrics.stringWidth(t, font, size) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def text_y(y, c, txt, font="Hand", size=13, color=INK_COLOR, x=None, max_w=None, line_gap=None):
    c.setFont(font, size)
    c.setFillColor(color)
    if max_w:
        for ln in wrap_text(txt, font, size, max_w):
            tx = x if x is not None else MARGIN_L + 14 * mm
            c.drawString(tx, y, ln)
            y -= line_gap if line_gap else size * 0.52
    else:
        tx = x if x is not None else MARGIN_L + 14 * mm
        c.drawString(tx, y, txt)
    return y


def heading(c, y, txt, size=22):
    c.setFont("HandBold", size)
    c.setFillColor(HEADING_COLOR)
    c.drawString(MARGIN_L + 14 * mm, y, txt)
    y -= size * 0.45
    c.setStrokeColor(HEADING_COLOR)
    c.setLineWidth(1.2)
    c.setDash(3, 2)
    c.line(MARGIN_L + 14 * mm, y, MARGIN_L + 14 * mm + pdfmetrics.stringWidth(txt, "HandBold", size) * 0.9, y)
    c.setDash()
    return y - 4 * mm


def highlight(c, y, txt, size=13):
    w = pdfmetrics.stringWidth(txt, "Hand", size) + 8
    c.setFillColor(HIGHLIGHT_COLOR)
    c.roundRect(MARGIN_L + 14 * mm, y - 2, w, size * 0.6, 3, fill=1, stroke=0)
    return text_y(y, c, txt, size=size)


def bullet(c, y, txt, size=13, symbol="•"):
    c.setFont("Body", size)
    c.setFillColor(INK_COLOR)
    c.drawString(MARGIN_L + 14 * mm, y, symbol)
    return text_y(y, c, txt, x=MARGIN_L + 20 * mm, max_w=PAGE_W - MARGIN_L - MARGIN_R - 20 * mm,
                   line_gap=size * 0.55)


def formula(c, y, txt, size=13.5):
    w = pdfmetrics.stringWidth(txt, "HandBold", size) + 12
    c.setFillColor(HexColor("#eaf2f8"))
    c.roundRect(MARGIN_L + 14 * mm, y - 2.5, w, size * 0.62, 4, fill=1, stroke=0)
    c.setFont("HandBold", size)
    c.setFillColor(HexColor("#1a5276"))
    c.drawString(MARGIN_L + 19 * mm, y, txt)
    return y - size * 0.85


def image_block(c, y, path, max_h=55 * mm, max_w=PAGE_W - MARGIN_L - MARGIN_R - 28 * mm):
    from PIL import Image as PILImage
    img = PILImage.open(path)
    iw, ih = img.size
    scale = min(max_w / iw, max_h / ih)
    w, h = iw * scale, ih * scale
    if y - h < MARGIN_B:
        c.showPage()
        draw_lined_paper(c)
        y = PAGE_H - MARGIN_T - 5 * mm
    c.drawImage(path, MARGIN_L + 14 * mm + (max_w - w) / 2, y - h, w, h,
                preserveAspectRatio=True, mask='auto')
    return y - h - 3 * mm


def main():
    figs = {
        "tri": make_triangle_types(),
        "ang": make_angles(),
        "circ": make_circle_parts(),
        "quad": make_quadrilaterals(),
        "cong": make_congruence(),
        "pyth": make_pythagoras(),
        "coord": make_coordinate(),
        "theo": make_theorems(),
        "3d": make_3d_shapes(),
        "ctheo": make_circle_theorems(),
        "areas": make_areas_parallels(),
        "ineq": make_triangle_inequality(),
    }

    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "docs", "geometry_notes_handwritten.pdf")
    os.makedirs(os.path.dirname(out), exist_ok=True)

    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("Geometry Chapter Notes — Handwritten Style")
    c.setAuthor("Trstprep")

    draw_lined_paper(c)
    y = PAGE_H - MARGIN_T - 5 * mm

    y = text_y(y, c, "GEOMETRY — Complete Chapter Notes", font="HandBold", size=30, color=HEADING_COLOR)
    y = text_y(y, c, "(Handwritten Revision Sheet — Class 9/10 level)", font="Hand", size=14,
               color=ACCENT_COLOR)
    y -= 4 * mm

    # --- Section 1: Lines & Angles ---
    y = heading(c, y, "1.  Lines & Angles")
    y = bullet(c, y, "When two lines meet, they form an ANGLE at the point of intersection (vertex).")
    y = bullet(c, y, "Complementary angles: sum = 90°    |    Supplementary angles: sum = 180°")
    y = bullet(c, y, "Vertically opposite angles are always EQUAL.")
    y = bullet(c, y, "Adjacent angles on a straight line add up to 180° (linear pair).")
    y -= 2 * mm
    y = image_block(c, y, figs["ang"], max_h=30 * mm)
    y -= 2 * mm

    # --- Section 2: Triangles ---
    y = heading(c, y, "2.  Triangles — Types & Properties")
    y = bullet(c, y, "By sides: Equilateral (all equal), Isosceles (two equal), Scalene (none equal).")
    y = bullet(c, y, "By angles: Acute (all < 90°), Right (one = 90°), Obtuse (one > 90°).")
    y = bullet(c, y, "Angle sum property:  ∠A + ∠B + ∠C = 180°")
    y = bullet(c, y, "Exterior angle = sum of two opposite interior angles.")
    y = bullet(c, y, "Pythagoras theorem (right triangles):  a² + b² = c²  (c = hypotenuse)")
    y = bullet(c, y, "Triangle inequality: sum of any two sides > third side.")
    y -= 2 * mm
    y = image_block(c, y, figs["tri"], max_h=36 * mm)
    y -= 2 * mm
    y = image_block(c, y, figs["pyth"], max_h=42 * mm)
    y -= 2 * mm

    # --- Section 3: Congruence & Similarity ---
    y = heading(c, y, "3.  Congruence & Similarity of Triangles")
    y = bullet(c, y, "CONGRUENT = same shape AND same size (all sides & angles equal).")
    y = bullet(c, y, "SIMILAR = same shape, different size (angles equal, sides proportional).")
    y = formula(c, y, "Congruence rules:  SSS · SAS · ASA · AAS · RHS (right-hypotenuse-side)")
    y = formula(c, y, "Similarity rules:  AAA · SSS (proportional) · SAS (proportional + included ∠)")
    y -= 2 * mm
    y = image_block(c, y, figs["cong"], max_h=32 * mm)
    y -= 2 * mm

    # --- Section 4: Circles ---
    y = heading(c, y, "4.  Circles — Key Concepts")
    y = bullet(c, y, "Radius (r): center to any point on circle. Diameter = 2r.")
    y = bullet(c, y, "Chord: line joining two points on circle. Longest chord = diameter.")
    y = bullet(c, y, "Tangent: touches circle at exactly ONE point. Tangent ⊥ radius at contact.")
    y = bullet(c, y, "Arc: part of circumference. Sector: region between two radii + arc.")
    y = bullet(c, y, "Angle at center = 2 × angle at circumference (same arc).")
    y = bullet(c, y, "Angles in the same segment are equal. Opposite angles of cyclic quad = 180°.")
    y = formula(c, y, "Area = πr²    |    Circumference = 2πr    |    Sector area = (θ/360°) × πr²")
    y -= 2 * mm
    y = image_block(c, y, figs["circ"], max_h=48 * mm)
    y -= 2 * mm

    # --- Section 5: Quadrilaterals ---
    y = heading(c, y, "5.  Quadrilaterals")
    y = bullet(c, y, "Sum of interior angles = 360°")
    y = bullet(c, y, "Square: all sides equal, all angles 90°, diagonals equal & bisect at 90°.")
    y = bullet(c, y, "Rectangle: opposite sides equal, all angles 90°, diagonals equal.")
    y = bullet(c, y, "Parallelogram: opposite sides parallel & equal, diagonals bisect each other.")
    y = bullet(c, y, "Rhombus: all sides equal, diagonals bisect at 90° (not equal).")
    y = bullet(c, y, "Trapezium: exactly one pair of parallel sides.")
    y = formula(c, y, "Area formulas: Square = a² · Rectangle = l×b · Para = base × height")
    y = formula(c, y, "                  Rhombus = ½×d₁×d₂ · Trapezium = ½×(a+b)×h")
    y -= 2 * mm
    y = image_block(c, y, figs["quad"], max_h=32 * mm)
    y -= 2 * mm

    # --- Section 6: Coordinate Geometry ---
    y = heading(c, y, "6.  Coordinate Geometry — Distance & Section")
    y = formula(c, y, "Distance:  d = √[(x₂ − x₁)² + (y₂ − y₁)²]")
    y = formula(c, y, "Midpoint:  M = ((x₁+x₂)/2 , (y₁+y₂)/2)")
    y = formula(c, y, "Section (ratio m:n):  ((mx₂+nx₁)/(m+n) , (my₂+ny₁)/(m+n))")
    y = formula(c, y, "Centroid of triangle:  ((x₁+x₂+x₃)/3 , (y₁+y₂+y₃)/3)")
    y = formula(c, y, "Area of triangle:  ½ |x₁(y₂−y₃) + x₂(y₃−y₁) + x₃(y₁−y₂)|")
    y -= 2 * mm
    y = image_block(c, y, figs["coord"], max_h=48 * mm)
    y -= 2 * mm

    # --- Section 7: Theorems at a Glance ---
    y = heading(c, y, "7.  Important Theorems")
    y = bullet(c, y, "Thales (Basic Proportionality): line parallel to one side divides other two proportionally.")
    y = bullet(c, y, "Midpoint Theorem: line joining midpoints of two sides || third side & half of it.")
    y = bullet(c, y, "Angle Bisector Theorem: BD/DC = AB/AC")
    y = bullet(c, y, "Cyclic Quadrilateral: opposite angles supplementary (sum = 180°).")
    y = bullet(c, y, "Tangent-Secant: PT² = PA × PB (power of a point).")
    y -= 2 * mm
    y = image_block(c, y, figs["theo"], max_h=34 * mm)
    y -= 2 * mm

    # --- Section 8: Circle Theorems (Detailed) ---
    y = heading(c, y, "8.  Circle Theorems (Detailed)")
    y = bullet(c, y, "Angle at center = 2 × angle at circumference subtended by same arc.")
    y = bullet(c, y, "Angle in a semicircle = 90° (Thales' theorem).")
    y = bullet(c, y, "Perpendicular from center to chord bisects the chord.")
    y = bullet(c, y, "Equal chords are equidistant from center, and vice versa.")
    y = bullet(c, y, "Angles in same segment are equal.")
    y = bullet(c, y, "Opposite angles of cyclic quadrilateral sum to 180°.")
    y = bullet(c, y, "Tangent ⊥ radius at point of contact.")
    y = bullet(c, y, "Tangent from external point: PT² = PA × PB (secant-tangent theorem).")
    y -= 2 * mm
    y = image_block(c, y, figs["ctheo"], max_h=32 * mm)
    y -= 2 * mm

    # --- Section 9: Areas Between Same Parallels ---
    y = heading(c, y, "9.  Areas — Parallelograms & Triangles")
    y = bullet(c, y, "Parallelogram on same base & between same parallels → equal area.")
    y = bullet(c, y, "Triangle on same base & between same parallels = ½ area of parallelogram.")
    y = bullet(c, y, "Median of triangle divides it into two triangles of equal area.")
    y = bullet(c, y, "Area of parallelogram = base × height (not side × side!)")
    y = bullet(c, y, "Area of triangle = ½ × base × height (height must be ⊥ to base).")
    y -= 2 * mm
    y = image_block(c, y, figs["areas"], max_h=32 * mm)
    y -= 2 * mm

    # --- Section 10: Triangle Inequalities ---
    y = heading(c, y, "10. Triangle Inequalities")
    y = bullet(c, y, "Sum of any two sides > third side: a + b > c, a + c > b, b + c > a.")
    y = bullet(c, y, "Difference of any two sides < third side: |a − b| < c.")
    y = bullet(c, y, "Side opposite larger angle is longer (and vice versa).")
    y = bullet(c, y, "In right triangle: hypotenuse is the longest side.")
    y -= 2 * mm
    y = image_block(c, y, figs["ineq"], max_h=28 * mm)
    y -= 2 * mm

    # --- Section 11: Surface Area & Volumes ---
    y = heading(c, y, "11. Surface Area & Volumes (3D Shapes)")
    y = bullet(c, y, "CSA = Curved/Lateral Surface Area. TSA = Total Surface Area.")
    y = formula(c, y, "Cone:  CSA = πrl · TSA = πr(r+l) · Vol = (1/3)πr²h · l = √(r²+h²)")
    y = formula(c, y, "Sphere:  SA = 4πr² · Vol = (4/3)πr³ · Hemisphere SA = 3πr²")
    y = formula(c, y, "Cylinder:  CSA = 2πrh · TSA = 2πr(r+h) · Vol = πr²h")
    y = formula(c, y, "Cube:  SA = 6a² · Vol = a³ · Diagonal = a√3")
    y = formula(c, y, "Cuboid:  SA = 2(lb+bh+hl) · Vol = lbh · Diagonal = √(l²+b²+h²)")
    y = formula(c, y, "Frustum:  Vol = (1/3)πh(R²+Rr+r²) · CSA = π(R+r)l")
    y -= 2 * mm
    y = image_block(c, y, figs["3d"], max_h=32 * mm)
    y -= 2 * mm

    # --- Section 12: Solved Examples ---
    y = heading(c, y, "12. Solved Examples")
    y = text_y(y, c, "Ex 1: Two angles are complementary. One is 35°. Find the other.", font="Body", size=11.5)
    y = formula(c, y, "90° − 35° = 55°")
    y -= 1 * mm
    y = text_y(y, c, "Ex 2: In ΔABC, ∠A = 65°, ∠B = 45°. Find ∠C.", font="Body", size=11.5)
    y = formula(c, y, "∠C = 180° − (65° + 45°) = 70°")
    y -= 1 * mm
    y = text_y(y, c, "Ex 3: Right triangle with legs 6 and 8. Find hypotenuse.", font="Body", size=11.5)
    y = formula(c, y, "c = √(6² + 8²) = √(36+64) = √100 = 10")
    y -= 1 * mm
    y = text_y(y, c, "Ex 4: Circle radius 7. Find area and circumference.", font="Body", size=11.5)
    y = formula(c, y, "Area = π(7)² = 154 · Circumference = 2π(7) = 44")
    y -= 1 * mm
    y = text_y(y, c, "Ex 5: Midpoint of A(2, 8) and B(6, 4).", font="Body", size=11.5)
    y = formula(c, y, "M = ((2+6)/2, (8+4)/2) = (4, 6)")
    y -= 1 * mm
    y = text_y(y, c, "Ex 6: Distance from origin to point (3, 4).", font="Body", size=11.5)
    y = formula(c, y, "d = √(3² + 4²) = √(9+16) = √25 = 5")
    y -= 2 * mm

    # --- Section 13: Common Mistakes & Exam Tips ---
    y = heading(c, y, "13. Common Mistakes & Exam Tips")
    y = bullet(c, y, "Confusing complementary (90°) vs supplementary (180°).")
    y = bullet(c, y, "Using side × side instead of base × height for parallelogram area.")
    y = bullet(c, y, "Forgetting the ½ in triangle area formula.")
    y = bullet(c, y, "Mixing up CSA vs TSA for 3D shapes.")
    y = bullet(c, y, "Not marking the right angle in Pythagoras problems.")
    y = bullet(c, y, "Assuming all similar triangles are congruent (or vice versa).")
    y = bullet(c, y, "TIP: Always draw a diagram — even a rough sketch helps!")
    y = bullet(c, y, "TIP: Label all given values on the diagram before solving.")
    y = bullet(c, y, "TIP: For constructions, use sharp pencil & show all arcs.")
    y -= 4 * mm
    y = text_y(y, c, "— End of Notes —  Revise daily, practice diagrams, all the best! —",
               font="Hand", size=14, color=ACCENT_COLOR, x=PAGE_W / 2 - 50 * mm)

    c.save()
    print(f"PDF created: {out}")


if __name__ == "__main__":
    main()
