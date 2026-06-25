#!/usr/bin/env python3
"""Generate corrected SSC Subject Taxonomy HTML dashboard."""

CSS = """body { font-family: sans-serif; background: #020617; color: #f8fafc; padding: 40px; }
      .node { margin-bottom: 8px; }
      .node-header { display: flex; align-items: center; gap: 12px; padding: 10px; background: #0f172a; border-radius: 8px; cursor: pointer; }
      .caret { width: 20px; text-align: center; }
      .node.open > .node-header .caret { transform: rotate(90deg); }
      .node-children { display: none; padding-left: 30px; border-left: 1px solid #1e293b; }
      .node.open > .node-children { display: block; }
      .type-badge { font-size: 0.7rem; padding: 2px 6px; background: #6366f1; border-radius: 4px; }
      .node-id { margin-left: auto; color: #64748b; font-size: 0.8rem; }
      .m-item { padding: 10px; background: #1e293b; margin-bottom: 5px; border-radius: 6px; }
      .pro { background: #f59e0b; color: black; padding: 2px 4px; font-size: 0.6rem; border-radius: 2px; }
      .empty { padding: 10px; color: #64748b; font-style: italic; }
      .grid { display: grid; grid-template-columns: 1fr 300px; gap: 40px; }"""

_node_counter = 0

def next_id():
    global _node_counter
    _node_counter += 1
    return _node_counter

def make_node(badge, name, children_html="", has_children=True):
    nid = next_id()
    caret = "▶" if has_children else "•"
    children_div = f'<div class="node-children">{children_html}</div>' if has_children else '<div class="node-children"><div class="empty">No nested items.</div></div>'
    return f'''      <div class="node">
        <div class="node-header">
          <div class="caret">{caret}</div>
          <div class="type-badge">{badge}</div>
          <div class="node-name">{name}</div>
          <div class="content-stats">
            
            
          </div>
          <div class="node-id">#{nid}</div>
        </div>
        {children_div}
      </div>'''

def build_tree():
    """Build the corrected SSC taxonomy tree."""
    
    # ===== 1. Quantitative Aptitude =====
    arithmetic_chapters = [
        ("Percentage", ["Basic Percentage", "Successive Percentage", "Population & Depreciation"]),
        ("Profit & Loss", ["Basic P&L", "Discount & Marked Price", "Dishonest Dealer", "Partnership"]),
        ("Discount", ["Trade Discount", "Successive Discount", "Equivalent Discount"]),
        ("Simple Interest", ["SI Formula", "Principal Calculation", "Rate Calculation", "Time Calculation"]),
        ("Compound Interest", ["CI Formula", "Annual Compounding", "Half Yearly", "Quarterly Compounding"]),
        ("Ratio & Proportion", ["Ratio Basics", "Proportion Problems", "Mixture & Alligation"]),
        ("Partnership", ["Simple Partnership", "Time Weighted Partnership", "Profit Sharing"]),
        ("Average", ["Basic Average", "Weighted Average", "Combined Average", "Average of Series"]),
        ("Mixture & Alligation", ["Alligation Rule", "Replacement Method", "Weighted Mixture"]),
        ("Time & Work", ["Basic Time & Work", "Work Efficiency", "Work Distribution", "Alternate Work", "Work and Wages"]),
        ("Pipe & Cistern", ["Filling Pipes", "Emptying Pipes", "Leak Problems"]),
        ("Time Speed Distance", ["Basic STD Concepts", "Relative Speed", "Average Speed"]),
        ("Boat & Stream", ["Upstream Speed", "Downstream Speed", "Still Water Speed"]),
        ("Train", ["Train Crossing Pole", "Train Crossing Platform", "Train Crossing Train"]),
        ("Age", ["Linear Age Problems", "Ratio-based Age", "Family Age Problems"]),
        ("Number System", ["Types of Numbers", "Divisibility Rules", "HCF and LCM", "Remainder Theorem", "Unit Digit", "Factorial & Trailing Zeros"]),
    ]
    
    arithmetic_children = ""
    for chap_name, topics in arithmetic_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        arithmetic_children += make_node("Chapter", chap_name, topic_children)
    
    arithmetic_unit = make_node("Unit", "Arithmetic", arithmetic_children)
    
    advanced_chapters = [
        ("Algebra", ["Algebraic Identities", "Surds and Indices", "Polynomials", "Quadratic Equations", "Linear Equations"]),
        ("Geometry", ["Lines and Angles", "Triangles", "Quadrilaterals", "Circles", "Coordinate Geometry"]),
        ("Mensuration", ["2D Mensuration", "3D Mensuration", "Cube & Cuboid", "Cylinder", "Cone", "Sphere"]),
        ("Trigonometry", ["Trigonometric Ratios", "Trigonometric Identities", "Heights & Distances"]),
        ("Coordinate Geometry", ["Section Formula", "Distance Formula", "Area of Triangle"]),
        ("Statistics", ["Mean", "Median", "Mode", "Standard Deviation"]),
    ]
    
    advanced_children = ""
    for chap_name, topics in advanced_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        advanced_children += make_node("Chapter", chap_name, topic_children)
    
    advanced_unit = make_node("Unit", "Advanced Maths", advanced_children)
    
    di_chapters = [
        ("Table DI", ["Table Interpretation"]),
        ("Bar Graph", ["Bar Graph Interpretation"]),
        ("Pie Chart", ["Pie Chart Interpretation"]),
        ("Line Graph", ["Line Graph Interpretation"]),
        ("Mixed DI", ["Mixed DI Interpretation"]),
    ]
    
    di_children = ""
    for chap_name, topics in di_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        di_children += make_node("Chapter", chap_name, topic_children)
    
    di_unit = make_node("Unit", "Data Interpretation", di_children)
    
    qa_part1 = make_node("Part", "Arithmetic", arithmetic_unit)
    qa_part2 = make_node("Part", "Advanced Maths", advanced_unit)
    qa_part3 = make_node("Part", "Data Interpretation", di_unit)
    
    qa_subject = make_node("Subject", "Quantitative Aptitude", qa_part1 + qa_part2 + qa_part3)
    
    # ===== 2. General Intelligence & Reasoning =====
    verbal_chapters = [
        ("Analogy", ["Word Analogy", "Number Analogy", "Figure Analogy"]),
        ("Classification", ["Word Classification", "Number Classification", "Figure Classification"]),
        ("Coding-Decoding", ["Simple Coding", "Complex Coding", "Symbol Coding"]),
        ("Blood Relation", ["Direct Relation", "Coded Relation"]),
        ("Direction Sense", ["Single Direction", "Multi Direction", "Shadow Problems"]),
        ("Ranking", ["Linear Ranking", "Circular Ranking"]),
        ("Syllogism", ["Basic Syllogism", "Possibility Cases", "Circular Representations"]),
        ("Statement & Conclusion", ["Direct Conclusion", "Implicit Conclusion"]),
    ]
    
    verbal_children = ""
    for chap_name, topics in verbal_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        verbal_children += make_node("Chapter", chap_name, topic_children)
    
    verbal_unit = make_node("Unit", "Verbal Reasoning", verbal_children)
    
    nonverbal_chapters = [
        ("Mirror Image", ["Mirror Image"]),
        ("Water Image", ["Water Image"]),
        ("Paper Folding", ["Paper Folding", "Paper Cutting"]),
        ("Embedded Figure", ["Embedded Figure"]),
        ("Figure Completion", ["Figure Completion"]),
    ]
    
    nonverbal_children = ""
    for chap_name, topics in nonverbal_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        nonverbal_children += make_node("Chapter", chap_name, topic_children)
    
    nonverbal_unit = make_node("Unit", "Non-Verbal Reasoning", nonverbal_children)
    
    logical_chapters = [
        ("Puzzle", ["Puzzle"]),
        ("Seating Arrangement", ["Linear Arrangement", "Circular Arrangement"]),
        ("Venn Diagram", ["Venn Diagram"]),
    ]
    
    logical_children = ""
    for chap_name, topics in logical_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        logical_children += make_node("Chapter", chap_name, topic_children)
    
    logical_unit = make_node("Unit", "Logical Reasoning", logical_children)
    
    reasoning_part1 = make_node("Part", "Verbal Reasoning", verbal_unit)
    reasoning_part2 = make_node("Part", "Non-Verbal Reasoning", nonverbal_unit)
    reasoning_part3 = make_node("Part", "Logical Reasoning", logical_unit)
    
    reasoning_subject = make_node("Subject", "General Intelligence & Reasoning", reasoning_part1 + reasoning_part2 + reasoning_part3)
    
    # ===== 3. English Language & Comprehension =====
    grammar_chapters = [
        ("Noun", ["Types of Noun", "Noun Usage"]),
        ("Pronoun", ["Types of Pronoun", "Pronoun Agreement"]),
        ("Verb", ["Types of Verb", "Verb Tense"]),
        ("Tense", ["Present Tense", "Past Tense", "Future Tense"]),
        ("Subject-Verb Agreement", ["SVA Rules", "SVA Errors"]),
        ("Voice", ["Active Voice", "Passive Voice"]),
        ("Narration", ["Direct Speech", "Indirect Speech"]),
        ("Preposition", ["Common Prepositions", "Preposition Usage"]),
        ("Conjunction", ["Types of Conjunction", "Conjunction Usage"]),
    ]
    
    grammar_children = ""
    for chap_name, topics in grammar_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        grammar_children += make_node("Chapter", chap_name, topic_children)
    
    grammar_unit = make_node("Unit", "Grammar", grammar_children)
    
    vocab_chapters = [
        ("Synonyms", ["Synonym Questions"]),
        ("Antonyms", ["Antonym Questions"]),
        ("One Word Substitution", ["One Word Substitution"]),
        ("Idioms & Phrases", ["Idiom Meaning", "Phrase Meaning"]),
        ("Spelling", ["Correct Spelling", "Incorrect Spelling"]),
    ]
    
    vocab_children = ""
    for chap_name, topics in vocab_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        vocab_children += make_node("Chapter", chap_name, topic_children)
    
    vocab_unit = make_node("Unit", "Vocabulary", vocab_children)
    
    reading_chapters = [
        ("Reading Comprehension", ["Passage Based Questions", "Inference Questions"]),
    ]
    
    reading_children = ""
    for chap_name, topics in reading_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        reading_children += make_node("Chapter", chap_name, topic_children)
    
    reading_unit = make_node("Unit", "Reading Comprehension", reading_children)
    
    misc_chapters = [
        ("Error Detection", ["Error Detection"]),
        ("Sentence Improvement", ["Sentence Improvement"]),
        ("Para Jumbles", ["Para Jumbles"]),
        ("Cloze Test", ["Cloze Test"]),
    ]
    
    misc_children = ""
    for chap_name, topics in misc_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        misc_children += make_node("Chapter", chap_name, topic_children)
    
    misc_unit = make_node("Unit", "Miscellaneous", misc_children)
    
    english_part1 = make_node("Part", "Grammar", grammar_unit)
    english_part2 = make_node("Part", "Vocabulary", vocab_unit)
    english_part3 = make_node("Part", "Reading Comprehension", reading_unit)
    english_part4 = make_node("Part", "Miscellaneous", misc_unit)
    
    english_subject = make_node("Subject", "English Language & Comprehension", english_part1 + english_part2 + english_part3 + english_part4)
    
    # ===== 4. General Awareness =====
    history_chapters = [
        ("Ancient History", ["Indus Valley Civilization", "Vedic Period", "Buddhism & Jainism", "Maurya Empire", "Gupta Empire"]),
        ("Medieval History", ["Delhi Sultanate", "Mughal Empire", "Bhakti & Sufi Movement", "Vijayanagara & Bahmani"]),
        ("Modern History", ["European Arrival", "Revolt of 1857", "Indian National Congress", "Gandhi Era", "Important Acts", "Freedom Fighters"]),
    ]
    
    history_children = ""
    for chap_name, topics in history_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        history_children += make_node("Chapter", chap_name, topic_children)
    
    history_unit = make_node("Unit", "History", history_children)
    
    geography_chapters = [
        ("Physical Geography", ["Solar System", "Earth Structure", "Atmosphere", "Rocks and Minerals", "Earthquakes & Volcanoes"]),
        ("Indian Geography", ["Physiographic Divisions", "Indian Rivers", "Indian Climate", "Soil Types", "Natural Vegetation"]),
        ("World Geography", ["Continents", "Oceans & Seas", "Deserts & Grasslands", "Climate Zones"]),
    ]
    
    geography_children = ""
    for chap_name, topics in geography_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        geography_children += make_node("Chapter", chap_name, topic_children)
    
    geography_unit = make_node("Unit", "Geography", geography_children)
    
    polity_chapters = [
        ("Constitution", ["Preamble", "Fundamental Rights", "Directive Principles"]),
        ("Parliament", ["Lok Sabha", "Rajya Sabha", "Parliamentary Procedures"]),
        ("Judiciary", ["Supreme Court", "High Court", "District Court"]),
        ("Fundamental Rights", ["Right to Equality", "Right to Freedom", "Right against Exploitation"]),
        ("Constitutional Bodies", ["Election Commission", "UPSC", "CAG"]),
    ]
    
    polity_children = ""
    for chap_name, topics in polity_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        polity_children += make_node("Chapter", chap_name, topic_children)
    
    polity_unit = make_node("Unit", "Polity", polity_children)
    
    economy_chapters = [
        ("Banking", ["Reserve Bank of India", "Commercial Banks", "NBFCs", "Monetary Policy"]),
        ("Budget", ["Union Budget", "Budget Basics", "Fiscal Policy"]),
        ("Inflation", ["Types of Inflation", "Inflation Effects", "Inflation Control"]),
        ("Taxation", ["Direct Tax", "Indirect Tax", "GST"]),
        ("Economic Terms", ["GDP", "GNP", "National Income"]),
    ]
    
    economy_children = ""
    for chap_name, topics in economy_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        economy_children += make_node("Chapter", chap_name, topic_children)
    
    economy_unit = make_node("Unit", "Economy", economy_children)
    
    science_chapters = [
        ("Physics", ["Mechanics", "Heat", "Light", "Sound", "Electricity", "Modern Physics"]),
        ("Chemistry", ["Atomic Structure", "Chemical Reactions", "Acids & Bases", "Metals & Non-Metals"]),
        ("Biology", ["Cell Biology", "Human Body Systems", "Plant Biology", "Diseases", "Genetics & Evolution", "Ecology"]),
    ]
    
    science_children = ""
    for chap_name, topics in science_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        science_children += make_node("Chapter", chap_name, topic_children)
    
    science_unit = make_node("Unit", "Science", science_children)
    
    static_gk_chapters = [
        ("Important Days", ["National Days", "International Days"]),
        ("Books & Authors", ["Important Books"]),
        ("Awards & Honours", ["National Awards", "International Awards"]),
        ("Sports", ["Cricket", "Olympics", "Sports Awards"]),
        ("Organizations", ["UN Organizations", "Indian Organizations"]),
        ("Important Places", ["Historical Monuments", "National Parks", "Dams & Rivers"]),
    ]
    
    static_gk_children = ""
    for chap_name, topics in static_gk_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        static_gk_children += make_node("Chapter", chap_name, topic_children)
    
    static_gk_unit = make_node("Unit", "Static GK", static_gk_children)
    
    current_affairs_chapters = [
        ("National", ["Government Schemes", "Appointments & Resignations", "Defence & Security"]),
        ("International", ["International Organizations", "Summits & Conferences"]),
        ("Economy", ["Union Budget", "RBI Policies", "Banking Updates"]),
        ("Science & Technology", ["ISRO Missions", "Tech Innovations"]),
        ("Sports", ["Major Tournaments", "Sports Awards"]),
        ("Awards & Honours", ["National Awards", "International Awards"]),
    ]
    
    current_affairs_children = ""
    for chap_name, topics in current_affairs_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        current_affairs_children += make_node("Chapter", chap_name, topic_children)
    
    current_affairs_unit = make_node("Unit", "Current Affairs", current_affairs_children)
    
    ga_part1 = make_node("Part", "History", history_unit)
    ga_part2 = make_node("Part", "Geography", geography_unit)
    ga_part3 = make_node("Part", "Polity", polity_unit)
    ga_part4 = make_node("Part", "Economy", economy_unit)
    ga_part5 = make_node("Part", "Science", science_unit)
    ga_part6 = make_node("Part", "Static GK", static_gk_unit)
    ga_part7 = make_node("Part", "Current Affairs", current_affairs_unit)
    
    ga_subject = make_node("Subject", "General Awareness", ga_part1 + ga_part2 + ga_part3 + ga_part4 + ga_part5 + ga_part6 + ga_part7)
    
    # ===== 5. Computer Knowledge =====
    fundamentals_chapters = [
        ("Hardware", ["Input & Output Devices", "CPU & Storage", "RAM", "ROM"]),
        ("Software", ["Operating System", "Application Software", "System Software"]),
        ("Operating System", ["Windows", "Linux", "macOS"]),
        ("Memory Devices", ["Primary Memory", "Secondary Memory"]),
    ]
    
    fundamentals_children = ""
    for chap_name, topics in fundamentals_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        fundamentals_children += make_node("Chapter", chap_name, topic_children)
    
    fundamentals_unit = make_node("Unit", "Fundamentals", fundamentals_children)
    
    ms_office_chapters = [
        ("MS Word", ["Word Basics", "Formatting", "Mail Merge"]),
        ("MS Excel", ["Excel Basics", "Formulas", "Charts"]),
        ("MS PowerPoint", ["PPT Basics", "Design", "Animations"]),
        ("MS Access", ["Database Basics", "Queries", "Reports"]),
    ]
    
    ms_office_children = ""
    for chap_name, topics in ms_office_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        ms_office_children += make_node("Chapter", chap_name, topic_children)
    
    ms_office_unit = make_node("Unit", "MS Office", ms_office_children)
    
    networking_chapters = [
        ("TCP/IP", ["TCP/IP Model", "IP Addressing"]),
        ("HTTP", ["HTTP Methods", "HTTP Status Codes"]),
        ("FTP", ["FTP Commands", "FTP Modes"]),
        ("DNS", ["DNS Resolution", "DNS Records"]),
        ("Email Protocols", ["SMTP", "POP3", "IMAP"]),
    ]
    
    networking_children = ""
    for chap_name, topics in networking_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        networking_children += make_node("Chapter", chap_name, topic_children)
    
    networking_unit = make_node("Unit", "Networking", networking_children)
    
    internet_chapters = [
        ("Browser", ["Browser Basics", "Browser Settings"]),
        ("Search Engine", ["Search Algorithms", "SEO Basics"]),
        ("Cookies", ["Cookie Types", "Cookie Management"]),
        ("Cloud Computing", ["Cloud Models", "Cloud Services"]),
    ]
    
    internet_children = ""
    for chap_name, topics in internet_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        internet_children += make_node("Chapter", chap_name, topic_children)
    
    internet_unit = make_node("Unit", "Internet", internet_children)
    
    cyber_chapters = [
        ("Virus", ["Types of Virus", "Virus Prevention"]),
        ("Malware", ["Types of Malware", "Malware Prevention"]),
        ("Phishing", ["Phishing Types", "Phishing Prevention"]),
        ("Firewall", ["Firewall Types", "Firewall Configuration"]),
        ("Encryption", ["Symmetric Encryption", "Asymmetric Encryption"]),
    ]
    
    cyber_children = ""
    for chap_name, topics in cyber_chapters:
        topic_children = "".join(make_node("Topic", t, has_children=False) for t in topics)
        cyber_children += make_node("Chapter", chap_name, topic_children)
    
    cyber_unit = make_node("Unit", "Cyber Security", cyber_children)
    
    ck_part1 = make_node("Part", "Fundamentals", fundamentals_unit)
    ck_part2 = make_node("Part", "MS Office", ms_office_unit)
    ck_part3 = make_node("Part", "Networking", networking_unit)
    ck_part4 = make_node("Part", "Internet", internet_unit)
    ck_part5 = make_node("Part", "Cyber Security", cyber_unit)
    
    ck_subject = make_node("Subject", "Computer Knowledge", ck_part1 + ck_part2 + ck_part3 + ck_part4 + ck_part5)
    
    # Combine all subjects
    tree = qa_subject + reasoning_subject + english_subject + ga_subject + ck_subject
    return tree

def build_sidebar():
    """Build the sidebar with exam info."""
    return '''    <div>
    <h2>SSC Exam Pattern</h2>
    <div class="m-item">
        <span class="m-title">Tier-I</span>
        <div class="m-info">100 Qs | 200 marks | 60 min</div>
    </div>
    <div class="m-item">
        <span class="m-title">Tier-II Paper-I</span>
        <div class="m-info">130 Qs | 390 marks | 120 min</div>
    </div>
    <div class="m-item">
        <span class="m-title">Computer Knowledge</span>
        <div class="m-info">Qualifying | 20 Qs | 60 marks</div>
    </div>
    <div class="m-item">
        <span class="m-title">DEST</span>
        <div class="m-info">Qualifying | Data Entry</div>
    </div>
    <h2 style="margin-top: 30px;">Subjects</h2>
    <div class="m-item">
        <span class="m-title">Quantitative Aptitude</span>
        <div class="m-info">Maths</div>
    </div>
    <div class="m-item">
        <span class="m-title">General Intelligence </span>
        <div class="m-info">Reasoning</div>
    </div>
    <div class="m-item">
        <span class="m-title">English Language </span>
        <div class="m-info">Comprehension</div>
    </div>
    <div class="m-item">
        <span class="m-title">General Awareness </span>
        <div class="m-info">GK + Science</div>
    </div>
    <div class="m-item">
        <span class="m-title">Computer Knowledge </span>
        <div class="m-info">Qualifying</div>
    </div></div>'''

def main():
    tree = build_tree()
    sidebar = build_sidebar()
    
    html = '<!DOCTYPE html><html><head><title>Study Dashboard</title>\n'
    html += '    <style>\n      ' + CSS + '\n    </style></head><body>\n'
    html += '    <h1>Study Material Dashboard</h1>\n'
    html += '    <div class="grid">\n'
    html += '      <div>\n'
    html += tree + '\n'
    html += '      </div>\n'
    html += '      <div>\n'
    html += sidebar + '\n'
    html += '      </div>\n'
    html += '    </div>\n'
    html += '    <script>\n'
    html += "      document.querySelectorAll('.node-header').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));\n"
    html += '    </script>\n'
    html += '    </body></html>'
    
    output_path = r'E:\Tech\Testprep\Trstprep V2.1\docs\architecture\study_hierarchy_dashboard.html'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f'Generated: {output_path}')
    print(f'Nodes: {_node_counter}')

if __name__ == '__main__':
    main()
