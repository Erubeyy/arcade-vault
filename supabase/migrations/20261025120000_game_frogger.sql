-- SPEC 11: Frogger reemplaza el placeholder `ranaria` (conserva id, position, cat, cover y color).
update public.games
set title = 'FROGGER',
    short = 'Cruza la carretera y el río sin convertirte en papilla.',
    long  = 'Guía a tu rana con las flechas o WASD a través de una carretera repleta de coches y camiones y de un río de troncos y tortugas que se sumergen. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.'
where id = 'ranaria';
