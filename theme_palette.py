"""Compile a scoped material colorway from Quiet's authoritative geometry.

Colors alone change; assets, layout, motion and semantic warning colors stay intact.
"""
import colorsys
import re

ROOT = 'html[data-nexus-interface=quiet][data-nexus-color=mint]'

def tint(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if l > .78 and s > .1 and 170 <= h * 360 <= 240:
        return (156, 245, 218)
    if l < .4 and (s < .35 or 175 <= h * 360 <= 250):
        return tuple(round(v * 255) for v in colorsys.hls_to_rgb(174 / 360, l, .28))
    if .4 <= l <= .78 and s < .3:
        return tuple(round(v * 255) for v in colorsys.hls_to_rgb(172 / 360, l, .16))
    return r, g, b

def colors(text):
    def hexadecimal(m):
        value = m[1]
        if len(value) in (3, 4): value = ''.join(c * 2 for c in value)
        r, g, b = tint(*(int(value[i:i + 2], 16) for i in (0, 2, 4)))
        return '#%02x%02x%02x' % (r, g, b) + value[6:]
    text = re.sub(r'#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])', hexadecimal, text)
    def rgb(m):
        r, g, b = tint(*(int(m[i]) for i in (2, 3, 4)))
        return m[1] + f'{r},{g},{b}' + m[5]
    return re.sub(r'(rgba?\(\s*)(\d+)\s*,\s*(\d+)\s*,\s*(\d+)([^)]*\))', rgb, text)

def split_selectors(value):
    result, start, depth = [], 0, 0
    for i, c in enumerate(value):
        if c in '([': depth += 1
        elif c in ')]': depth -= 1
        elif c == ',' and depth == 0:
            result.append(value[start:i].strip()); start = i + 1
    result.append(value[start:].strip())
    return result

def mint_css(css):
    css = re.sub(r'/\*[\s\S]*?\*/', '', css)
    def compile_block(block):
        output, at = [], 0
        while at < len(block):
            opening = block.find('{', at)
            if opening < 0: break
            head = block[at:opening].strip()
            depth, end = 1, opening + 1
            while end < len(block) and depth:
                if block[end] == '{': depth += 1
                elif block[end] == '}': depth -= 1
                end += 1
            if depth: raise ValueError('Unbalanced Quiet CSS')
            body = block[opening + 1:end - 1]
            if head.startswith(('@media', '@supports', '@container')):
                output.append(head + '{' + compile_block(body) + '}')
            elif not head.startswith('@'):
                selectors = []
                for selector in split_selectors(head):
                    if not selector or '.nexus-quiet-color' in selector: continue
                    if selector.startswith('html'):
                        selector = selector.replace('html[data-nexus-interface=quiet]', ROOT, 1) if selector.startswith('html[data-nexus-interface=quiet]') else ROOT + selector[4:]
                    else: selector = ROOT + ' ' + selector
                    selectors.append(selector)
                if selectors: output.append(','.join(selectors) + '{' + colors(body) + '}')
            at = end
        return '\n'.join(output)
    return '\n/* Compiled Mint colorway: original layout, locally scoped materials. */\n' + compile_block(css)
