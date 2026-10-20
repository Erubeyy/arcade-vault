-- SPEC 08: Arkanoid reemplaza el placeholder `bloque-buster` (conserva id, position, cat, cover y color).
update public.games
set title = 'ARKANOID',
    short = 'Rompe todos los bloques y no dejes caer la bola.',
    long  = 'Mueve la paleta y haz rebotar la bola para derribar los bloques de cada nivel. El ángulo del rebote depende del punto de la paleta donde golpea; los bloques grises aguantan dos golpes. Tienes 3 vidas y 8 niveles de figuras distintas, cada uno con una bola más rápida que el anterior. Lanza la bola con ESPACIO.'
where id = 'bloque-buster';
