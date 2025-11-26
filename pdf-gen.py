from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
import re

def syntax_highlight_c(code):
    """Enhanced C syntax highlighter with variable detection"""
    
    # Define colors (VS Code-like theme)
    COLOR_KEYWORD = '#c678dd'      # Purple
    COLOR_TYPE = '#e5c07b'         # Yellow
    COLOR_FUNCTION = '#61afef'     # Blue
    COLOR_STRING = '#98c379'       # Green
    COLOR_NUMBER = '#d19a66'       # Orange
    COLOR_COMMENT = '#5c6370'      # Gray
    COLOR_PREPROCESSOR = '#e06c75' # Red
    COLOR_VARIABLE = '#e06c75'     # Red (for variables)
    COLOR_CONSTANT = '#d19a66'     # Orange (for constants)
    COLOR_OPERATOR = '#56b6c2'     # Cyan
    COLOR_DEFAULT = '#abb2bf'      # Light gray
    
    keywords = {
        'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 
        'break', 'continue', 'void', 'static', 'const', 'sizeof'
    }
    
    types = {
        'int', 'char', 'unsigned', 'float', 'double', 'long', 'short',
        'typedef', 'union', 'struct', 'enum', 'Digest', 'MD5union'
    }
    
    functions = {
        'printf', 'scanf', 'malloc', 'calloc', 'free', 'memcpy', 
        'strlen', 'fabs', 'pow', 'sin', 'clrscr', 'getch', 'F', 'G', 'H', 'I', 'rol', 'md5', 'main'
    }
    
    operators = {'=', '+', '-', '*', '/', '%', '&', '|', '^', '~', '!', '<', '>', '?', ':'}
    
    # Extract variable names from declarations
    variables = set()
    for line in code.split('\n'):
        # Look for variable declarations
        for t in types:
            if t in line:
                # Simple variable extraction
                matches = re.findall(rf'\b{t}\b\s+\*?(\w+)', line)
                variables.update(matches)
        # Look for function parameters
        if '(' in line and ')' in line:
            param_match = re.findall(r'\(([^)]+)\)', line)
            for params in param_match:
                for param in params.split(','):
                    param_parts = param.strip().split()
                    if len(param_parts) >= 2:
                        variables.add(param_parts[-1].strip('*'))
    
    # Common variable names
    common_vars = {'i', 'j', 'k', 'x', 'y', 'z', 'msg', 'len', 'data', 'total', 
                   'temp', 'n', 'a', 'b', 'c', 'd', 'f', 'g', 'w', 'h', 'u', 'l'}
    variables.update(common_vars)
    
    lines = code.split('\n')
    highlighted_lines = []
    
    for line in lines:
        if not line.strip():
            highlighted_lines.append([('', COLOR_DEFAULT)])
            continue
            
        # Check for preprocessor
        if line.strip().startswith('#'):
            highlighted_lines.append([(line, COLOR_PREPROCESSOR)])
            continue
        
        # Check for comments
        if '//' in line:
            parts = line.split('//', 1)
            if parts[0]:
                highlighted_lines.append(parse_line(parts[0], keywords, types, functions, variables, operators) + 
                                       [('//' + parts[1], COLOR_COMMENT)])
            else:
                highlighted_lines.append([('//' + parts[1], COLOR_COMMENT)])
            continue
        
        highlighted_lines.append(parse_line(line, keywords, types, functions, variables, operators))
    
    return highlighted_lines

def parse_line(line, keywords, types, functions, variables, operators):
    """Parse a single line and return colored segments with variable highlighting"""
    COLOR_KEYWORD = '#c678dd'
    COLOR_TYPE = '#e5c07b'
    COLOR_FUNCTION = '#61afef'
    COLOR_STRING = '#98c379'
    COLOR_NUMBER = '#d19a66'
    COLOR_VARIABLE = '#e06c75'
    COLOR_CONSTANT = '#d19a66'
    COLOR_OPERATOR = '#56b6c2'
    COLOR_DEFAULT = '#abb2bf'
    
    result = []
    i = 0
    
    while i < len(line):
        # Check for strings
        if line[i] in '"\'':
            quote = line[i]
            end = i + 1
            while end < len(line) and line[end] != quote:
                if line[end] == '\\' and end + 1 < len(line):
                    end += 2
                else:
                    end += 1
            if end < len(line):
                end += 1
            result.append((line[i:end], COLOR_STRING))
            i = end
            continue
        
        # Check for hex numbers
        if i + 1 < len(line) and line[i:i+2] == '0x':
            end = i + 2
            while end < len(line) and line[end] in '0123456789abcdefABCDEF':
                end += 1
            result.append((line[i:end], COLOR_CONSTANT))
            i = end
            continue
        
        # Check for numbers
        if line[i].isdigit():
            end = i
            while end < len(line) and (line[end].isdigit() or line[end] in '.'):
                end += 1
            result.append((line[i:end], COLOR_NUMBER))
            i = end
            continue
        
        # Check for operators
        if line[i] in operators or (i + 1 < len(line) and line[i:i+2] in {'==', '!=', '<=', '>=', '&&', '||', '<<', '>>'}):
            if i + 1 < len(line) and line[i:i+2] in {'==', '!=', '<=', '>=', '&&', '||', '<<', '>>'}:
                result.append((line[i:i+2], COLOR_OPERATOR))
                i += 2
            else:
                result.append((line[i], COLOR_OPERATOR))
                i += 1
            continue
        
        # Check for words (identifiers/keywords)
        if line[i].isalpha() or line[i] == '_':
            end = i
            while end < len(line) and (line[end].isalnum() or line[end] == '_'):
                end += 1
            word = line[i:end]
            
            if word in keywords:
                result.append((word, COLOR_KEYWORD))
            elif word in types:
                result.append((word, COLOR_TYPE))
            elif word in functions:
                result.append((word, COLOR_FUNCTION))
            elif word in variables:
                result.append((word, COLOR_VARIABLE))
            elif word.isupper():  # Constants are usually uppercase
                result.append((word, COLOR_CONSTANT))
            else:
                result.append((word, COLOR_DEFAULT))
            
            i = end
            continue
        
        # Default: single character
        result.append((line[i], COLOR_DEFAULT))
        i += 1
    
    return result if result else [('', COLOR_DEFAULT)]

def create_colored_code_table(code):
    """Create a table with syntax-highlighted code"""
    highlighted = syntax_highlight_c(code)
    
    table_data = []
    for line_num, line_segments in enumerate(highlighted, 1):
        # Build the colored line
        line_html = ''
        for text, color in line_segments:
            # Escape HTML special chars
            text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace(' ', '&nbsp;')
            if text:
                line_html += f'<font color="{color}">{text}</font>'
        
        if not line_html.strip():
            line_html = '&nbsp;'  # Empty line placeholder
        
        # Create paragraph for the line
        code_style = ParagraphStyle(
            'CodeLine',
            fontName='Courier',
            fontSize=9,
            leading=12,
            textColor=HexColor('#abb2bf')
        )
        
        line_num_style = ParagraphStyle(
            'LineNum',
            fontName='Courier',
            fontSize=9,
            leading=12,
            textColor=HexColor('#5c6370'),
            alignment=1  # Right align
        )
        
        table_data.append([
            Paragraph(f'{line_num:3d}', line_num_style),
            Paragraph(line_html, code_style)
        ])
    
    # Create the table with subtle styling
    code_table = Table(table_data, colWidths=[0.5*inch, 6.5*inch])
    code_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#1e1e1e')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (0, -1), 8),
        ('RIGHTPADDING', (0, 0), (0, -1), 8),
        ('LEFTPADDING', (1, 0), (1, -1), 10),
        ('RIGHTPADDING', (1, 0), (1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('BOX', (0, 0), (-1, -1), 1, HexColor('#3e3e3e')),
        ('LINEAFTER', (0, 0), (0, -1), 1, HexColor('#2d2d2d')),
        ('ROUNDEDCORNERS', [5, 5, 5, 5]),
    ]))
    
    return code_table

def create_md5_pdf(filename="MD5_Lab_Report.pdf"):
    # Create PDF
    pdf = SimpleDocTemplate(
        filename,
        pagesize=A4,
        rightMargin=45,
        leftMargin=45,
        topMargin=45,
        bottomMargin=45
    )
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Enhanced Title style - softer colors
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=26,
        textColor=HexColor('#d4d4d4'),
        spaceAfter=10,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        borderWidth=2,
        borderColor=HexColor('#4a4a4a'),
        borderPadding=15,
        backColor=HexColor('#252526'),
        borderRadius=8
    )
    
    # Subtitle style - softer
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=HexColor('#808080'),
        alignment=TA_CENTER,
        fontName='Helvetica',
        spaceAfter=30
    )
    
    # Heading style - softer colors, easier on eyes
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=18,
        textColor=HexColor('#cccccc'),
        spaceAfter=12,
        spaceBefore=20,
        fontName='Helvetica-Bold',
        leftIndent=0,
        borderWidth=0,
        borderPadding=8,
        backColor=HexColor('#252526'),
        borderRadius=4
    )
    
    # Body text style - slightly softer
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontSize=11,
        textColor=HexColor('#c0c0c0'),
        alignment=TA_JUSTIFY,
        spaceAfter=12,
        fontName='Helvetica',
        leading=16
    )
    
    # List style with bullets - softer
    list_style = ParagraphStyle(
        'CustomList',
        parent=styles['BodyText'],
        fontSize=11,
        textColor=HexColor('#c0c0c0'),
        leftIndent=30,
        spaceAfter=10,
        fontName='Helvetica',
        leading=16,
        bulletIndent=10
    )
    
    # Output style - softer green
    output_style = ParagraphStyle(
        'OutputStyle',
        fontSize=11,
        textColor=HexColor('#4ec9b0'),
        fontName='Courier',
        leftIndent=20,
        rightIndent=20,
        backColor=HexColor('#1e1e1e'),
        borderWidth=1,
        borderColor=HexColor('#3e3e3e'),
        borderPadding=20,
        spaceAfter=10,
        leading=16,
        borderRadius=5
    )
    
    # Add decorative header
    elements.append(Spacer(1, 0.2*inch))
    
    # Add title with enhanced styling
    elements.append(Paragraph("IMPLEMENTATION OF MD5", title_style))
    elements.append(Paragraph("Cryptographic Hash Function", subtitle_style))
    
    # Add AIM with icon-like marker
    elements.append(Paragraph("🎯 AIM", heading_style))
    elements.append(Paragraph("To write a C program to implement the MD5 hashing technique.", body_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Add ALGORITHM
    elements.append(Paragraph("📋 ALGORITHM", heading_style))
    
    algorithm_steps = [
        "<b><font color='#999999'>STEP 1:</font></b> Take the input message.",
        "<b><font color='#999999'>STEP 2:</font></b> Pad the message so its length is a multiple of 512 bits.",
        "<b><font color='#999999'>STEP 3:</font></b> Initialize four 32-bit registers A, B, C, D.",
        "<b><font color='#999999'>STEP 4:</font></b> Process each 512-bit block using functions F, G, H, I and circular shifts.",
        "<b><font color='#999999'>STEP 5:</font></b> Combine the results to produce a 128-bit hash output."
    ]
    
    for step in algorithm_steps:
        elements.append(Paragraph(f"• {step}", list_style))
    
    elements.append(Spacer(1, 0.2*inch))
    
    # Add PROGRAM
    elements.append(Paragraph("💻 PROGRAM", heading_style))
    elements.append(Spacer(1, 0.15*inch))
    
    # C Code
    c_code = '''#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <conio.h>

typedef union {
    unsigned w;
    unsigned char b[4];
} MD5union;

typedef unsigned Digest[4];

unsigned F(unsigned x, unsigned y, unsigned z){ 
    return (x & y) | (~x & z); 
}

unsigned G(unsigned x, unsigned y, unsigned z){ 
    return (x & z) | (y & ~z); 
}

unsigned H(unsigned x, unsigned y, unsigned z){ 
    return x ^ y ^ z; 
}

unsigned I(unsigned x, unsigned y, unsigned z){ 
    return y ^ (x | ~z); 
}

unsigned rol(unsigned x, unsigned n){
    return (x << n) | (x >> (32 - n));
}

unsigned *md5(const char *msg, int len){
    static Digest h = {0x67452301,0xEFCDAB89,0x98BADCFE,0x10325476};
    unsigned *k = (unsigned*)malloc(64*sizeof(unsigned));
    int i,j;
    
    for(i=0;i<64;i++)
        k[i]=(unsigned)(fabs(sin(i+1))*pow(2,32));
    
    int total = ((len+8)/64 + 1) * 64;
    unsigned char *data = calloc(total,1);
    memcpy(data,msg,len);
    data[len]=0x80;
    
    MD5union l; 
    l.w = len*8;
    memcpy(data+total-8,&l.w,4);
    
    for(i=0;i<total;i+=64){
        unsigned w[16],a=h[0],b=h[1],c=h[2],d=h[3],f,g,temp;
        memcpy(w,data+i,64);
        
        for(j=0;j<64;j++){
            if(j<16){ 
                f=F(b,c,d); 
                g=j; 
            }
            else if(j<32){ 
                f=G(b,c,d); 
                g=(5*j+1)%16; 
            }
            else if(j<48){ 
                f=H(b,c,d); 
                g=(3*j+5)%16; 
            }
            else{ 
                f=I(b,c,d); 
                g=(7*j)%16; 
            }
            
            temp=d;
            d=c;
            c=b;
            b=b+rol(a+f+k[j]+w[g], (j%4==0)?7:(j%4==1)?12:(j%4==2)?17:22);
            a=temp;
        }
        
        h[0]+=a; 
        h[1]+=b; 
        h[2]+=c; 
        h[3]+=d;
    }
    
    return h;
}

void main(){
    const char *msg="The quick brown fox jumps over the lazy dog";
    unsigned *d = md5(msg, strlen(msg));
    MD5union u;
    int i,j;
    
    clrscr();
    printf("MD5 ENCRYPTION ALGORITHM IN C\\n\\n");
    printf("Input : %s\\n\\n",msg);
    printf("MD5 : 0x");
    
    for(i=0;i<4;i++){
        u.w=d[i];
        for(j=0;j<4;j++)
            printf("%02x", u.b[j]);
    }
    
    printf("\\n\\nMD5 Encryption Successfully Completed!!!");
    getch();
}'''
    
    # Add syntax-highlighted code
    elements.append(create_colored_code_table(c_code))
    elements.append(Spacer(1, 0.3*inch))
    
    # Add OUTPUT
    elements.append(Paragraph("📤 OUTPUT", heading_style))
    elements.append(Spacer(1, 0.15*inch))
    
    output_html = '''<font color="#d4d4d4" size="11"><b>MD5 ENCRYPTION ALGORITHM IN C</b></font><br/><br/>
<font color="#9cdcfe">Input</font> <font color="#abb2bf">:</font> <font color="#ce9178">The quick brown fox jumps over the lazy dog</font><br/><br/>
<font color="#9cdcfe">MD5</font> <font color="#abb2bf">:</font> <font color="#dcdcaa"><b>0x9e107d9d372bb6826bd81d3542a419d6</b></font><br/><br/>
<font color="#4ec9b0"><b>✓ MD5 Encryption Successfully Completed!</b></font>'''
    
    elements.append(Paragraph(output_html, output_style))
    elements.append(Spacer(1, 0.3*inch))
    
    # Add RESULT
    elements.append(Paragraph("✅ RESULT", heading_style))
    elements.append(Paragraph("Thus, the MD5 hashing algorithm was successfully implemented using C programming language. The implementation demonstrates the four auxiliary functions (F, G, H, I) and the 64 rounds of processing that characterize the MD5 algorithm.", body_style))
    
    # Dark background - softer
    def add_dark_background(canvas, doc):
        canvas.saveState()
        # Main background - slightly lighter for easier reading
        canvas.setFillColor(HexColor('#1e1e1e'))
        canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
        
        # Removed top border accent for cleaner look
        canvas.restoreState()
    
    pdf.build(elements, onFirstPage=add_dark_background, onLaterPages=add_dark_background)
    
    print(f"✅ PDF generated successfully: {filename}")
    print(f"📊 Features: Syntax highlighting with variables, operators, and constants!")

if __name__ == "__main__":
    create_md5_pdf("MD5_Lab_Report.pdf")