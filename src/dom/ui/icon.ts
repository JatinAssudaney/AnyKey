const SVG = 'http://www.w3.org/2000/svg';

/** An SVG element: its tag, its attributes and the elements inside it. */
type Shape = readonly [tag: string, attributes: Readonly<Record<string, string>>, children?: readonly Shape[]];

/** The toolbar icon, src/assets/icon.svg, element by element. A test keeps the two the same. */
const ICON: Shape = [
  'svg',
  { width: '128', height: '128', viewBox: '0 0 128 128' },
  [
    [
      'defs',
      {},
      [
        [
          'linearGradient',
          { id: 'face', x1: '0', y1: '0', x2: '0', y2: '1' },
          [
            ['stop', { offset: '0', 'stop-color': '#fb923c' }],
            ['stop', { offset: '1', 'stop-color': '#f97316' }],
          ],
        ],
      ],
    ],
    ['rect', { x: '4', y: '6', width: '120', height: '118', rx: '26', fill: '#9a3412' }],
    ['rect', { x: '14', y: '10', width: '100', height: '92', rx: '18', fill: 'url(#face)' }],
    [
      'path',
      {
        fill: '#ffffff',
        'fill-rule': 'evenodd',
        d: 'M57 30 H71 L92 82 H78 L73.15 70 H54.85 L50 82 H36 Z M64 47.35 L69.11 60 H58.89 Z',
      },
    ],
  ],
];

function draw([tag, attributes, children = []]: Shape): SVGElement {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children.map(draw));
  return element;
}

/**
 * AnyKey's icon, for in-page UI. It is built as elements because an image would need a web-accessible file, which
 * pages can probe for, and parsing the file's markup would trip pages that enforce Trusted Types.
 */
export function anyKeyIcon(): SVGElement {
  const icon = draw(ICON);
  icon.setAttribute('class', 'ak-icon');
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}
