// Level layouts: 10 columns per row, up to 10 rows, one char per block.
// '.' empty | g gray | r red | y yellow | c cyan | m magenta | h hotpink | e green
const LEVEL_CHARS = {
  g: 'gray', r: 'red', y: 'yellow', c: 'cyan',
  m: 'magenta', h: 'hotpink', e: 'green',
};

const LEVELS = [
  { // 1 - Classic
    speed: 360,
    rows: [
      'gggggggggg',
      'rrrrrrrrrr',
      'yyyyyyyyyy',
      'cccccccccc',
      'mmmmmmmmmm',
      'eeeeeeeeee',
    ],
  },
  { // 2 - Pyramid
    speed: 390,
    rows: [
      '....gg....',
      '...rrrr...',
      '..yyyyyy..',
      '.cccccccc.',
      'mmmmmmmmmm',
      'hhhhhhhhhh',
    ],
  },
  { // 3 - Checkerboard
    speed: 420,
    rows: [
      'g.g.g.g.g.',
      '.y.y.y.y.y',
      'c.c.c.c.c.',
      '.m.m.m.m.m',
      'h.h.h.h.h.',
      '.e.e.e.e.e',
    ],
  },
  { // 4 - Diamond
    speed: 450,
    rows: [
      '....cc....',
      '...cyyc...',
      '..cyggyc..',
      '.cyg..gyc.',
      '.cyg..gyc.',
      '..cyggyc..',
      '...cyyc...',
      '....cc....',
    ],
  },
  { // 5 - Pillars
    speed: 480,
    rows: [
      'gg..gg..gg',
      'rr..cc..mm',
      'rr..cc..mm',
      'rr..cc..mm',
      'yy..ee..hh',
      'yy..ee..hh',
      'yy..ee..hh',
      'yy..ee..hh',
    ],
  },
  { // 6 - Invader
    speed: 510,
    rows: [
      '..e....e..',
      '...e..e...',
      '..eeeeee..',
      '.ee.ee.ee.',
      'gggggggggg',
      'e.eeeeee.e',
      'e.e....e.e',
      '..ee..ee..',
    ],
  },
  { // 7 - Fortress
    speed: 540,
    rows: [
      'gggggggggg',
      'g........g',
      'g.rrrrrr.g',
      'g.ryyyyr.g',
      'g.rymmyr.g',
      'g.ryyyyr.g',
      'g.rrrrrr.g',
      'g........g',
      'gggggggggg',
    ],
  },
  { // 8 - X
    speed: 570,
    rows: [
      'hh......hh',
      '.hh....hh.',
      '..hh..hh..',
      '...hggh...',
      '....gg....',
      '....gg....',
      '...hggh...',
      '..hh..hh..',
      '.hh....hh.',
      'hh......hh',
    ],
  },
];
