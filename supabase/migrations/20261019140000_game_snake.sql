-- SPEC 09: Snake reemplaza el placeholder `serpentina` (conserva id, position, cat, cover y color).
update public.games
set title = 'SNAKE',
    short = 'Come frutas, crece y no te muerdas la cola.',
    long  = 'Guía a la serpiente con las flechas o WASD y come las frutas que aparecen al azar: cada una suma 10 puntos y te hace crecer un segmento. Los bordes del tablero son un portal, así que sales por un lado y apareces por el opuesto; lo único que mata es morderte el cuerpo. Con cada fruta la serpiente va más rápido y cada 5 frutas subes de nivel.'
where id = 'serpentina';
