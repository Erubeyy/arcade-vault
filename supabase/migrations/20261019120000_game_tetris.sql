-- SPEC 07: Tetris reemplaza el placeholder `caida` (conserva id y position).
update public.games
set title = 'TETRIS',
    short = 'Encaja las piezas, completa líneas y aguanta el ritmo.',
    long  = 'Siete piezas descienden por un tablero de 10×20. Muévelas, rótalas con ayuda de los wall kicks y déjalas caer al instante con ESPACIO; la pieza fantasma te muestra dónde aterrizará. Completa líneas para puntuar y sube de nivel cada 10: la caída se acelera sin piedad.',
    cover = 'cover-tetro',
    color = 'magenta'
where id = 'caida';
