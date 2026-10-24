-- School calendar: no-school days, first/last day, quarter ends and middle-school events.
-- Source: 2026-2027 Sioux Falls School District Parent Calendar.
-- kind: no_school | first_day | last_day | resume | quarter_end | event

CREATE TABLE school_calendar (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  school_year TEXT NOT NULL,
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('no_school','first_day','last_day','resume','quarter_end','event')),
  title       TEXT NOT NULL
);
CREATE INDEX school_calendar_dates ON school_calendar (start_date, end_date);

INSERT INTO school_calendar (school_year, start_date, end_date, kind, title) VALUES
  ('2026-27', '2026-08-24', '2026-08-24', 'event',       'Middle School PST'),
  ('2026-27', '2026-08-27', '2026-08-27', 'first_day',   'First Day of School'),
  ('2026-27', '2026-09-04', '2026-09-04', 'no_school',   'Labor Day Break'),
  ('2026-27', '2026-09-07', '2026-09-07', 'no_school',   'Labor Day Break'),
  ('2026-27', '2026-10-12', '2026-10-12', 'no_school',   'Native American Day'),
  ('2026-27', '2026-10-13', '2026-10-13', 'no_school',   'Inservice'),
  ('2026-27', '2026-10-22', '2026-10-22', 'event',       'Middle School Conferences (evening)'),
  ('2026-27', '2026-10-27', '2026-10-27', 'event',       'Middle School Conferences (evening)'),
  ('2026-27', '2026-10-29', '2026-10-29', 'quarter_end', 'End of 1st Quarter'),
  ('2026-27', '2026-11-11', '2026-11-11', 'no_school',   'Veterans Day'),
  ('2026-27', '2026-11-25', '2026-11-25', 'no_school',   'Compensatory Day'),
  ('2026-27', '2026-11-26', '2026-11-27', 'no_school',   'Thanksgiving Break'),
  ('2026-27', '2026-12-23', '2027-01-01', 'no_school',   'Holiday Break'),
  ('2026-27', '2027-01-04', '2027-01-04', 'resume',      'Classes Resume'),
  ('2026-27', '2027-01-14', '2027-01-14', 'quarter_end', 'End of 2nd Quarter'),
  ('2026-27', '2027-01-15', '2027-01-15', 'no_school',   'Teacher Work Day'),
  ('2026-27', '2027-01-18', '2027-01-18', 'no_school',   'Martin Luther King Jr. Day'),
  ('2026-27', '2027-02-15', '2027-02-16', 'no_school',   'Presidents'' Day Break'),
  ('2026-27', '2027-03-01', '2027-03-01', 'no_school',   'Inservice'),
  ('2026-27', '2027-03-04', '2027-03-04', 'event',       'Middle School Conferences (evening)'),
  ('2026-27', '2027-03-09', '2027-03-09', 'event',       'Middle School Conferences (evening)'),
  ('2026-27', '2027-03-23', '2027-03-23', 'quarter_end', 'End of 3rd Quarter'),
  ('2026-27', '2027-03-26', '2027-03-29', 'no_school',   'Spring Break'),
  ('2026-27', '2027-04-19', '2027-04-19', 'no_school',   'Compensatory Day'),
  ('2026-27', '2027-05-26', '2027-05-26', 'last_day',    'Last Day of School');
