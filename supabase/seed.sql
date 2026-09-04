insert into public.events (id, slug, title, subtitle, background_path, quiz_enabled)
values (
  '10000000-0000-0000-0000-000000000001',
  'team-building-2026',
  'Team Building 2026',
  'Team Building 2026',
  'event-media/backgrounds/team-building-2026.jpg',
  true
);

insert into public.teams (id, event_id, name, color, emblem, display_order) values
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Atlas', '#D1495B', 'mountain', 0),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'Orion', '#00798C', 'constellation', 1),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'Sirocco', '#EDAE49', 'wind', 2),
  ('20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'Volt', '#30638E', 'lightning', 3),
  ('20000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', 'Ember', '#7A3B69', 'flame', 4);

insert into public.challenges (event_id, title, kind, description, image_path, display_order) values
  ('10000000-0000-0000-0000-000000000001', 'Tour de confiance', 'teamwork', 'Traversez le parcours en vous guidant mutuellement.', 'event-media/challenges/trust.jpg', 0),
  ('10000000-0000-0000-0000-000000000001', 'Code express', 'puzzle', 'Résolvez le code avant les autres équipes.', 'event-media/challenges/code.jpg', 1),
  ('10000000-0000-0000-0000-000000000001', 'Relais créatif', 'creative', 'Construisez une histoire en relais.', 'event-media/challenges/story.jpg', 2),
  ('10000000-0000-0000-0000-000000000001', 'Défi précision', 'skill', 'Atteignez la cible avec le moins d essais.', 'event-media/challenges/target.jpg', 3),
  ('10000000-0000-0000-0000-000000000001', 'Final collectif', 'teamwork', 'Assemblez les indices pour ouvrir le coffre.', 'event-media/challenges/finale.jpg', 4);

insert into public.quiz_categories (id, event_id, title, image_path, display_order, status) values
  ('50000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Culture générale', 'event-media/quiz/culture.jpg', 0, 'available'),
  ('50000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'Cinéma', 'event-media/quiz/cinema.jpg', 1, 'available'),
  ('50000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'Musique', 'event-media/quiz/music.jpg', 2, 'available'),
  ('50000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'Sport', 'event-media/quiz/sport.jpg', 3, 'available'),
  ('50000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', 'Sciences', 'event-media/quiz/science.jpg', 4, 'available'),
  ('50000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001', 'Surprises', 'event-media/quiz/surprise.jpg', 5, 'available');

insert into public.quiz_questions (id, category_id, prompt, points, display_order) values
  ('60000000-0000-0000-0000-000000000011', '50000000-0000-0000-0000-000000000011', 'Combien de continents compte-t-on habituellement ?', 10, 0),
  ('60000000-0000-0000-0000-000000000012', '50000000-0000-0000-0000-000000000012', 'Qui a réalisé le film Inception ?', 10, 0),
  ('60000000-0000-0000-0000-000000000013', '50000000-0000-0000-0000-000000000013', 'Quel groupe a chanté Bohemian Rhapsody ?', 10, 0),
  ('60000000-0000-0000-0000-000000000014', '50000000-0000-0000-0000-000000000014', 'Combien de joueurs une équipe de football aligne-t-elle sur le terrain ?', 10, 0),
  ('60000000-0000-0000-0000-000000000015', '50000000-0000-0000-0000-000000000015', 'Quelle planète est surnommée la planète rouge ?', 10, 0),
  ('60000000-0000-0000-0000-000000000016', '50000000-0000-0000-0000-000000000016', 'Quelle couleur obtient-on en mélangeant le bleu et le jaune ?', 10, 0);

insert into public.quiz_question_answers (question_id, answer) values
  ('60000000-0000-0000-0000-000000000011', 'Sept'),
  ('60000000-0000-0000-0000-000000000012', 'Christopher Nolan'),
  ('60000000-0000-0000-0000-000000000013', 'Queen'),
  ('60000000-0000-0000-0000-000000000014', 'Onze'),
  ('60000000-0000-0000-0000-000000000015', 'Mars'),
  ('60000000-0000-0000-0000-000000000016', 'Vert');

insert into public.quiz_sessions (id, event_id, team_order, current_team_index, active_question_index, answer_visible)
values (
  '70000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000001',
  array[
    '20000000-0000-0000-0000-000000000011'::uuid,
    '20000000-0000-0000-0000-000000000012'::uuid,
    '20000000-0000-0000-0000-000000000013'::uuid,
    '20000000-0000-0000-0000-000000000014'::uuid,
    '20000000-0000-0000-0000-000000000015'::uuid
  ],
  0,
  0,
  false
);
