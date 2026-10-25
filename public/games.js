/* Let's Hang — extra games. Each game registers itself with LH_GAMES and gets a small toolkit (ctx) from app.js:
   ctx.s        this game's saved state (reset when the game is opened)
   ctx.paint()  redraw the screen          ctx.esc(text)  safe HTML
   ctx.pick(a)  random item                ctx.shuffle(a) shuffled copy
   ctx.best(v)  report a finished score → saves your personal best + posts it to the friends leaderboard
   ctx.confetti(), ctx.toast(msg), ctx.beep(hz, ms), ctx.active() → still on this game?
   Buttons use data-act="gx" data-x="<action>" and land in game.act(action, el, ctx). */
(() => {
  'use strict';
  const games = [];
  const add = (g) => games.push(g);
  window.LH_GAMES = games;
  const rnd = (n) => Math.floor(Math.random() * n);
  const btn = (x, label, cls = 'ghost-button', extra = '') => `<button class="${cls}" data-act="gx" data-x="${x}" ${extra}>${label}</button>`;
  const pill = (t, cls = '') => `<span class="pill ${cls}">${t}</span>`;
  const bestPill = (ctx, fmt = (v) => v) => (ctx.bestVal() != null ? pill(`Best: ${fmt(ctx.bestVal())}`, 'st-approved') : '');
  const stopTimer = (s) => { clearInterval(s.timer); clearTimeout(s.timeout); s.timer = s.timeout = null; };

  // ================================================================ QUIZ ENGINE (10 multiple-choice questions)
  function quiz({ id, title, emoji, cat, make, ask }) {
    add({
      id, title, emoji, cat, dir: 'high', unit: '/ 10',
      init(ctx) { const s = ctx.s; s.qs = make(ctx).slice(0, 10).map((q) => ({ ...q, opts: ctx.shuffle(q.opts) })); s.i = 0; s.score = 0; s.picked = null; },
      render(ctx) {
        const s = ctx.s, e = ctx.esc;
        if (s.i >= s.qs.length) return `<div class="panel stack center"><p class="big-win">${s.score} / ${s.qs.length}</p>
          <p>${s.score >= 9 ? 'Genius level! 🧠' : s.score >= 6 ? 'Great job! 🔥' : 'Nice try — go again! 💪'}</p>${bestPill(ctx, (v) => `${v} / 10`)}
          ${btn('again', 'Play again', 'primary-button block')}</div>`;
        const q = s.qs[s.i];
        return `<div class="panel stack">
          <div class="row spread">${pill(`${s.i + 1} of ${s.qs.length}`)}${pill(`Score: ${s.score}`, 'st-approved')}</div>
          ${q.clue ? `<p class="center emoji-clue" aria-label="Clue">${q.clue}</p>` : ''}
          <h3 class="${q.clue ? 'center' : ''}">${e(q.q || ask || '')}</h3>
          <div class="quiz-opts">${q.opts.map((o) => { const st = s.picked == null ? '' : o === q.right ? 'right' : o === s.picked ? 'wrong' : ''; return `<button class="quiz-opt ${st}" data-act="gx" data-x="pick" data-o="${e(o)}" ${s.picked != null ? 'disabled' : ''}>${e(o)}</button>`; }).join('')}</div>
          ${s.picked != null ? `<p class="center" aria-live="polite"><b>${s.picked === q.right ? ctx.pick(['Correct! ✅', 'Yes! 🎯', 'Nailed it! 🙌', 'You got it! ⭐']) : `It's ${e(q.right)}`}</b>${q.why ? `<br><span class="small muted">${e(q.why)}</span>` : ''}</p>
            ${btn('next', s.i + 1 < s.qs.length ? 'Next →' : 'See score', 'primary-button block')}` : ''}</div>`;
      },
      act(x, el, ctx) {
        const s = ctx.s;
        if (x === 'pick' && s.picked == null) { s.picked = el.dataset.o; if (s.picked === s.qs[s.i].right) s.score++; }
        if (x === 'next') { s.i++; s.picked = null; if (s.i >= s.qs.length) { ctx.best(s.score); if (s.score >= 8) ctx.confetti(); } }
        if (x === 'again') this.init(ctx);
        ctx.paint();
      },
    });
  }
  // questions whose wrong answers come from the other answers in the same list
  const fromPool = (pool, toQ) => (ctx) => ctx.shuffle(pool).slice(0, 10).map((item) => {
    const wrong = ctx.shuffle(pool.filter((p) => p[1] !== item[1])).slice(0, 3).map((p) => p[1]);
    return { ...toQ(item), right: item[1], opts: [item[1], ...wrong] };
  });
  // questions written as [question, right, wrong, wrong, wrong]
  const fromList = (list) => (ctx) => ctx.shuffle(list).slice(0, 10).map(([q, right, ...wrong]) => ({ q, right, opts: [right, ...wrong] }));

  const FLAGS = [['🇺🇸', 'United States'], ['🇨🇦', 'Canada'], ['🇲🇽', 'Mexico'], ['🇯🇵', 'Japan'], ['🇫🇷', 'France'], ['🇮🇹', 'Italy'], ['🇩🇪', 'Germany'], ['🇬🇧', 'United Kingdom'],
    ['🇧🇷', 'Brazil'], ['🇮🇳', 'India'], ['🇨🇳', 'China'], ['🇰🇷', 'South Korea'], ['🇦🇺', 'Australia'], ['🇪🇸', 'Spain'], ['🇮🇪', 'Ireland'], ['🇸🇪', 'Sweden'], ['🇳🇴', 'Norway'],
    ['🇬🇷', 'Greece'], ['🇯🇲', 'Jamaica'], ['🇿🇦', 'South Africa'], ['🇦🇷', 'Argentina'], ['🇳🇬', 'Nigeria'], ['🇵🇭', 'Philippines'], ['🇳🇿', 'New Zealand']];
  quiz({ id: 'flags', title: 'Flag Guess', emoji: '🏁', cat: 'quiz', ask: 'Which country has this flag?', make: fromPool(FLAGS, ([f]) => ({ clue: f })) });

  const CAPITALS = [['France', 'Paris'], ['Japan', 'Tokyo'], ['Italy', 'Rome'], ['Spain', 'Madrid'], ['Germany', 'Berlin'], ['Canada', 'Ottawa'], ['Mexico', 'Mexico City'],
    ['Egypt', 'Cairo'], ['Australia', 'Canberra'], ['Brazil', 'Brasília'], ['China', 'Beijing'], ['India', 'New Delhi'], ['Russia', 'Moscow'], ['United Kingdom', 'London'],
    ['Kenya', 'Nairobi'], ['Argentina', 'Buenos Aires'], ['South Korea', 'Seoul'], ['Greece', 'Athens'], ['Ireland', 'Dublin'], ['Norway', 'Oslo'], ['Peru', 'Lima'], ['Thailand', 'Bangkok']];
  quiz({ id: 'capitals', title: 'World Capitals', emoji: '🌍', cat: 'quiz', make: fromPool(CAPITALS, ([c]) => ({ q: `What is the capital of ${c}?` })) });

  const FOOD = [['🍕', 'Pizza'], ['🌮', 'Taco'], ['🍔', 'Hamburger'], ['🍣', 'Sushi'], ['🥐', 'Croissant'], ['🍩', 'Donut'], ['🥨', 'Pretzel'], ['🧇', 'Waffle'], ['🥞', 'Pancakes'],
    ['🌭', 'Hot dog'], ['🍝', 'Spaghetti'], ['🥯', 'Bagel'], ['🍿', 'Popcorn'], ['🧁', 'Cupcake'], ['🥑', 'Avocado'], ['🍉', 'Watermelon'], ['🥥', 'Coconut'], ['🍍', 'Pineapple'],
    ['🥦', 'Broccoli'], ['🌽', 'Corn'], ['🥟', 'Dumpling'], ['🌯', 'Burrito'], ['🧀', 'Cheese'], ['🥕', 'Carrot']];
  quiz({ id: 'food', title: 'Name That Food', emoji: '🍔', cat: 'quiz', ask: 'What food is this?', make: fromPool(FOOD, ([f]) => ({ clue: f })) });

  quiz({ id: 'animals', title: 'Animal Facts', emoji: '🦒', cat: 'quiz', make: fromList([
    ['What is the largest animal on Earth?', 'Blue whale', 'African elephant', 'Giraffe', 'Great white shark'],
    ['What is the tallest animal?', 'Giraffe', 'Elephant', 'Ostrich', 'Moose'],
    ['How many hearts does an octopus have?', '3', '1', '2', '8'],
    ['What is a group of lions called?', 'A pride', 'A pack', 'A herd', 'A flock'],
    ['What do giant pandas mostly eat?', 'Bamboo', 'Fish', 'Berries', 'Grass'],
    ['Which bird can fly backwards?', 'Hummingbird', 'Eagle', 'Penguin', 'Parrot'],
    ['How many legs does an insect have?', '6', '8', '4', '10'],
    ['What is a baby frog called?', 'Tadpole', 'Cub', 'Kit', 'Joey'],
    ['Which mammal can really fly?', 'Bat', 'Flying squirrel', 'Sugar glider', 'Ostrich'],
    ["What is a camel's hump mostly made of?", 'Fat', 'Water', 'Muscle', 'Bone'],
    ['How many arms does a starfish usually have?', '5', '3', '6', '8'],
    ['Which is the largest big cat?', 'Tiger', 'Lion', 'Cheetah', 'Leopard'],
    ['Which animal has black-and-white stripes?', 'Zebra', 'Tiger', 'Leopard', 'Giraffe'],
    ['Where do most penguins live?', 'Southern Hemisphere', 'North Pole', 'Sahara Desert', 'Amazon rainforest'],
    ['What is the fastest land animal?', 'Cheetah', 'Horse', 'Lion', 'Greyhound'],
  ]) });
  quiz({ id: 'space', title: 'Space Quiz', emoji: '🪐', cat: 'quiz', make: fromList([
    ['Which planet is closest to the Sun?', 'Mercury', 'Venus', 'Earth', 'Mars'],
    ['How many planets are in our solar system?', '8', '9', '7', '10'],
    ['What does the Moon orbit?', 'Earth', 'The Sun only', 'Mars', 'Jupiter'],
    ['Who was the first person to walk on the Moon?', 'Neil Armstrong', 'Buzz Aldrin', 'John Glenn', 'Yuri Gagarin'],
    ['Which is the hottest planet?', 'Venus', 'Mercury', 'Mars', 'Jupiter'],
    ['What is the Sun?', 'A star', 'A planet', 'A moon', 'A comet'],
    ['Which planet has the Great Red Spot?', 'Jupiter', 'Mars', 'Saturn', 'Neptune'],
    ['How long does Earth take to go around the Sun?', 'About 365 days', '30 days', '24 hours', '100 days'],
    ['What is the name of our galaxy?', 'Milky Way', 'Andromeda', 'Sombrero', 'Whirlpool'],
    ['Which planet spins on its side?', 'Uranus', 'Neptune', 'Saturn', 'Venus'],
    ['What keeps us on the ground?', 'Gravity', 'Magnetism', 'Wind', 'Friction'],
    ['How many moons does Mars have?', '2', '0', '1', '4'],
    ['What is a "shooting star" really?', 'A meteor', 'A falling star', 'A rocket', 'A satellite'],
    ['Which planet is famous for its rings?', 'Saturn', 'Earth', 'Mercury', 'Mars'],
  ]) });
  quiz({ id: 'sports', title: 'Sports Trivia', emoji: '🏈', cat: 'quiz', make: fromList([
    ['How many players does a soccer team have on the field?', '11', '9', '10', '12'],
    ['A basketball shot from behind the arc is worth…', '3 points', '2 points', '4 points', '1 point'],
    ['How many holes are in a regular round of golf?', '18', '9', '12', '20'],
    ['How many points is a touchdown?', '6', '7', '3', '5'],
    ['Which sport uses a puck?', 'Hockey', 'Lacrosse', 'Rugby', 'Cricket'],
    ['How many bases are on a baseball field (counting home)?', '4', '3', '5', '6'],
    ['In tennis, a score of zero is called…', 'Love', 'Nil', 'Zip', 'Duck'],
    ['Where did the ancient Olympics begin?', 'Greece', 'Italy', 'Egypt', 'China'],
    ['How many rings are on the Olympic flag?', '5', '4', '6', '7'],
    ['Knocking down all the pins on your first ball is a…', 'Strike', 'Spare', 'Split', 'Gutter'],
    ['How many periods are in a hockey game?', '3', '2', '4', '5'],
    ['How many players per side in indoor volleyball?', '6', '5', '7', '9'],
    ['About how long is a marathon?', '26.2 miles', '13.1 miles', '10 miles', '50 miles'],
  ]) });
  quiz({ id: 'riddles', title: 'Riddles', emoji: '🧩', cat: 'quiz', make: fromList([
    ["What has hands but can't clap?", 'A clock', 'A tree', 'A robot', 'A glove'],
    ['What gets wetter the more it dries?', 'A towel', 'A sponge', 'Rain', 'Soap'],
    ["What has keys but can't open locks?", 'A piano', 'A door', 'A car', 'A map'],
    ['What has to be broken before you can use it?', 'An egg', 'A promise', 'A window', 'A pencil'],
    ['What goes up but never comes down?', 'Your age', 'A balloon', 'A rocket', 'Smoke'],
    ['What has a neck but no head?', 'A bottle', 'A snake', 'A lamp', 'A shoe'],
    ["What can you catch but not throw?", 'A cold', 'A ball', 'A frisbee', 'A pillow'],
    ["What has one eye but can't see?", 'A needle', 'A pirate', 'A cyclops', 'A doorbell'],
    ["I'm full of holes but still hold water. What am I?", 'A sponge', 'A bucket', 'A net', 'A cloud'],
    ["What has lots of teeth but can't bite?", 'A comb', 'A shark', 'A dog', 'A baby'],
    ['What runs but never walks?', 'A river', 'A cat', 'A snail', 'A rock'],
    ['What has a thumb and four fingers but is not alive?', 'A glove', 'A fork', 'A sock', 'A spoon'],
    ['The more you take, the more you leave behind. What are they?', 'Footsteps', 'Cookies', 'Coins', 'Crayons'],
    ['What building has the most stories?', 'A library', 'A skyscraper', 'A hotel', 'A school'],
  ]) });
  quiz({ id: 'truefalse', title: 'True or False', emoji: '✅', cat: 'quiz', make: (ctx) => ctx.shuffle([
    ['Bats are blind.', false, 'Bats can see — many also use echoes to find food.'], ['The Sun is a star.', true], ['Octopuses have three hearts.', true],
    ['Lightning never strikes the same place twice.', false, 'Tall buildings get hit many times a year.'], ['A tomato is a fruit.', true], ['Goldfish only remember things for 3 seconds.', false, 'Goldfish can remember for months!'],
    ['Adults have 206 bones.', true], ['Antarctica is the coldest continent.', true], ['Sound travels faster than light.', false, 'Light is way faster — that’s why you see lightning before thunder.'],
    ['Penguins can fly.', false, 'They “fly” underwater instead!'], ['Venus is the hottest planet.', true], ['Sharks are mammals.', false, 'Sharks are fish.'],
    ['You can see the Great Wall of China from the Moon with your eyes.', false], ['Honey can last thousands of years without going bad.', true], ['Spiders are insects.', false, 'Spiders have 8 legs — they’re arachnids.'],
    ['Water boils at 212°F at sea level.', true], ['Koalas are bears.', false, 'Koalas are marsupials.'], ['Mount Everest is the tallest mountain above sea level.', true],
  ]).slice(0, 10).map(([q, t, why]) => ({ q, right: t ? 'True' : 'False', opts: ['True', 'False'], why })) });
  quiz({ id: 'oddone', title: 'Odd One Out', emoji: '🔎', cat: 'quiz', ask: 'Which one doesn’t belong?', make: (ctx) => ctx.shuffle([
    [['Apple', 'Banana', 'Grape'], 'Carrot'], [['Dog', 'Cat', 'Horse'], 'Eagle'], [['Red', 'Blue', 'Green'], 'Circle'], [['Mercury', 'Mars', 'Venus'], 'The Moon'],
    [['Piano', 'Guitar', 'Violin'], 'Hammer'], [['2', '4', '8'], '7'], [['Salmon', 'Shark', 'Tuna'], 'Dolphin'], [['January', 'March', 'July'], 'Monday'],
    [['Triangle', 'Square', 'Pentagon'], 'Cube'], [['Oak', 'Maple', 'Pine'], 'Rose'], [['Eye', 'Ear', 'Nose'], 'Shoe'], [['9', '16', '25'], '30'],
    [['Rain', 'Snow', 'Hail'], 'Sand'], [['Soccer', 'Tennis', 'Baseball'], 'Sandwich'], [['Spring', 'Summer', 'Winter'], 'Tuesday'],
  ]).slice(0, 10).map(([same, odd]) => ({ q: 'Which one doesn’t belong?', right: odd, opts: [...same, odd] })) });
  quiz({ id: 'nextup', title: 'What Comes Next?', emoji: '🔢', cat: 'quiz', make: () => Array.from({ length: 10 }, (_, i) => {
    if (i % 3 === 2) {
      const sets = [['🍎', '🍌'], ['⭐', '🌙', '☀️'], ['🐶', '🐶', '🐱'], ['🔴', '🔵', '🟢', '🟡']], set = sets[rnd(sets.length)], len = set.length * 2 + rnd(set.length);
      const seq = Array.from({ length: len }, (_, k) => set[k % set.length]); const right = set[len % set.length];
      const opts = [...new Set([right, ...set, '🍇', '💎'])].slice(0, 4);
      return { q: 'What comes next?', clue: seq.join(' ') + ' ❓', right, opts };
    }
    const kind = rnd(3), a = 1 + rnd(9), d = 2 + rnd(8);
    const seq = kind === 2 ? [a, a * 2, a * 4, a * 8] : kind === 1 ? [a + d * 4, a + d * 3, a + d * 2, a + d] : [a, a + d, a + d * 2, a + d * 3];
    const right = String(kind === 2 ? a * 16 : kind === 1 ? a : a + d * 4);
    const opts = [...new Set([right, String(+right + d), String(+right - 1), String(+right + 1), String(+right + 2)])].slice(0, 4);
    return { q: 'What number comes next?', clue: seq.join(', ') + ', ?', right, opts };
  }) });
  quiz({ id: 'spelling', title: 'Spelling Bee', emoji: '🐝', cat: 'quiz', ask: 'Which one is spelled right?', make: (ctx) => ctx.shuffle([
    ['because', 'becuase', 'becaus', 'beacuse'], ['friend', 'freind', 'frend', 'friand'], ['beautiful', 'beautifull', 'beutiful', 'beatiful'], ['necessary', 'neccessary', 'necesary', 'nesessary'],
    ['separate', 'seperate', 'separete', 'saparate'], ['different', 'diffrent', 'differant', 'diferent'], ['library', 'libary', 'liberry', 'librery'], ['February', 'Febuary', 'Feburary', 'Februery'],
    ['tomorrow', 'tommorow', 'tomorow', 'tommorrow'], ['calendar', 'calender', 'calandar', 'calander'], ['definitely', 'definately', 'definitly', 'defenitely'], ['believe', 'beleive', 'belive', 'beleve'],
    ['restaurant', 'restaraunt', 'resturant', 'restaurent'], ['Wednesday', 'Wensday', 'Wednsday', 'Wedensday'], ['science', 'sience', 'scince', 'sciense'], ['receive', 'recieve', 'receeve', 'resieve'],
    ['occasion', 'ocassion', 'occassion', 'ocasion'],
  ]).slice(0, 10).map(([right, ...wrong]) => ({ q: 'Which one is spelled right?', right, opts: [right, ...wrong] })) });

  // ================================================================ 🧠 MIND BENDERS — high-school-level challenges for kids who want a real workout
  quiz({ id: 'brainteasers', title: 'Brain Teasers', emoji: '🤯', cat: 'brain', make: fromList([
    ['A bat and a ball cost $1.10 total. The bat costs $1.00 more than the ball. How much is the ball?', '5¢', '10¢', '1¢', '15¢'],
    ['5 machines make 5 widgets in 5 minutes. How long do 100 machines take to make 100 widgets?', '5 minutes', '100 minutes', '20 minutes', '1 minute'],
    ['A patch of lily pads doubles every day and covers the whole lake on day 48. On what day did it cover half?', 'Day 47', 'Day 24', 'Day 46', 'Day 36'],
    ['How many times can you subtract 5 from 25?', 'Once', '5 times', '4 times', '25 times'],
    ["Mary's father has five daughters: Nana, Nene, Nini, Nono… what is the fifth daughter's name?", 'Mary', 'Nunu', 'Nina', 'Nobody'],
    ['In a race, you pass the person in 2nd place. What place are you in now?', '2nd', '1st', '3rd', 'Last'],
    ['A clock shows 3:15. What is the angle between the hour and minute hands?', '7.5°', '0°', '15°', '30°'],
    ['Unscramble CIFAIPC. It is the name of a…', 'Ocean', 'City', 'Animal', 'Country'],
    ['Some months have 31 days. How many months have 28 days?', '12', '1', '2', '6'],
    ['A farmer has 17 sheep. All but 9 run away. How many are left?', '9', '8', '17', '0'],
    ['What is half of 2 plus 2?', '3', '2', '4', '1'],
    ['How many squares of ALL sizes are on a chessboard?', '204', '64', '65', '128'],
    ['3 cats catch 3 mice in 3 minutes. How many cats catch 100 mice in 100 minutes?', '3', '100', '33', '300'],
    ['A rope ladder hangs off a ship with 4 rungs above the water. The tide rises 3 feet. How many rungs are above water now?', 'Still 4 — the ship floats', '1', '0', '7'],
    ['If you have one, you want to share it. If you share it, you don’t have it. What is it?', 'A secret', 'A cookie', 'A toy', 'A seat'],
  ]) });
  quiz({ id: 'algebra', title: 'Algebra & Geometry', emoji: '📐', cat: 'brain', make: fromList([
    ['Solve: 3x + 7 = 22', 'x = 5', 'x = 4', 'x = 6', 'x = 9'],
    ['What is the slope of y = −2x + 5?', '−2', '5', '2', '−5'],
    ['What do the inside angles of a hexagon add up to?', '720°', '540°', '360°', '1080°'],
    ['A right triangle has legs 6 and 8. How long is the hypotenuse?', '10', '12', '14', '9'],
    ['What is 2⁵?', '32', '25', '10', '16'],
    ['What is √144?', '12', '14', '11', '72'],
    ['Area of a circle with radius 3?', '9π', '6π', '3π', '18π'],
    ['If f(x) = x² − 4, what is f(−3)?', '5', '−13', '13', '−5'],
    ['Solve x² = 49', 'x = 7 or x = −7', 'x = 7 only', 'x = 24.5', 'x = −7 only'],
    ['What is 15% of 80?', '12', '15', '8', '10'],
    ['Factor: x² + 5x + 6', '(x + 2)(x + 3)', '(x + 1)(x + 6)', '(x − 2)(x − 3)', '(x + 5)(x + 1)'],
    ['Volume of a cube with sides of 4?', '64', '16', '48', '12'],
    ['What is the next prime number after 89?', '97', '91', '93', '95'],
    ['Write 0.75 as a fraction', '3/4', '7/5', '2/3', '75/10'],
    ['Two angles are complementary. One is 35°. What is the other?', '55°', '145°', '65°', '45°'],
    ['Simplify: x³ · x⁴', 'x⁷', 'x¹²', 'x', '2x⁷'],
  ]) });
  quiz({ id: 'science', title: 'Science Lab', emoji: '🧪', cat: 'brain', make: fromList([
    ['What is the chemical symbol for gold?', 'Au', 'Ag', 'Gd', 'Go'],
    ['Which part of the cell is called the “powerhouse”?', 'Mitochondria', 'Nucleus', 'Ribosome', 'Chloroplast'],
    ['What is the pH of pure water at room temperature?', '7', '0', '14', '1'],
    ["Newton's second law is…", 'F = ma', 'E = mc²', 'V = IR', 'PV = nRT'],
    ["What is the most common gas in Earth's air?", 'Nitrogen', 'Oxygen', 'Carbon dioxide', 'Argon'],
    ['About how fast does light travel?', '300,000 km per second', '300 km per second', '3,000 km per second', '30 million km per second'],
    ['Which particle has a negative charge?', 'Electron', 'Proton', 'Neutron', 'Photon'],
    ["An element's atomic number is its number of…", 'Protons', 'Neutrons', 'Molecules', 'Energy levels'],
    ['What shape is a DNA molecule?', 'Double helix', 'Single strand', 'Triple helix', 'Square lattice'],
    ['How do plants make food from sunlight?', 'Photosynthesis', 'Respiration', 'Fermentation', 'Transpiration'],
    ['Which planet has the strongest gravity?', 'Jupiter', 'Saturn', 'Earth', 'Neptune'],
    ['H₂O₂ is…', 'Hydrogen peroxide', 'Water', 'Ozone', 'Hydroxide'],
    ['What unit measures electrical resistance?', 'Ohm', 'Volt', 'Ampere', 'Watt'],
    ['Which blood cells fight infection?', 'White blood cells', 'Red blood cells', 'Platelets', 'Plasma'],
    ['Absolute zero is about…', '−273 °C', '0 °C', '−100 °C', '−373 °C'],
    ['What is the chemical formula for table salt?', 'NaCl', 'KCl', 'NaOH', 'CaCO₃'],
  ]) });
  quiz({ id: 'vocab', title: 'Word Wizard', emoji: '📚', cat: 'brain', make: fromList([
    ['“Ephemeral” means…', 'Lasting a very short time', 'Very large', 'Extremely loud', 'Full of energy'],
    ['“Benevolent” means…', 'Kind and generous', 'Angry', 'Lazy', 'Mysterious'],
    ['“Ubiquitous” means…', 'Found everywhere', 'Very rare', 'Hard to see', 'Ancient'],
    ['“Candid” means…', 'Honest and direct', 'Sweet', 'Shy', 'Secretive'],
    ['“Meticulous” means…', 'Very careful with details', 'Messy', 'Quick', 'Forgetful'],
    ['“Gregarious” means…', 'Sociable — likes company', 'Greedy', 'Grumpy', 'Gigantic'],
    ['“Lethargic” means…', 'Sluggish and tired', 'Deadly', 'Energetic', 'Lucky'],
    ['“Ambiguous” means…', 'Having more than one meaning', 'Using both hands', 'Very ambitious', 'Clearly stated'],
    ['“Resilient” means…', 'Able to bounce back', 'Easily broken', 'Very shy', 'Always late'],
    ['What is the opposite of “verbose”?', 'Concise', 'Wordy', 'Loud', 'Vivid'],
    ['Which word means the same as “elated”?', 'Overjoyed', 'Delayed', 'Tired', 'Confused'],
    ['“Pragmatic” means…', 'Practical', 'Dramatic', 'Imaginary', 'Stubborn'],
    ['“Tenacious” means…', 'Persistent — doesn’t give up', 'Nervous', 'Tense', 'Gentle'],
    ['“Obsolete” means…', 'No longer used', 'Brand new', 'Very large', 'Required'],
    ['“Plethora” means…', 'A large amount', 'A small piece', 'A disease', 'A shortage'],
    ['“Inevitable” means…', 'Certain to happen', 'Impossible', 'Invisible', 'Unlikely'],
  ]) });
  quiz({ id: 'history', title: 'History & Civics', emoji: '🏛️', cat: 'brain', make: fromList([
    ['When was the Declaration of Independence signed?', '1776', '1787', '1492', '1812'],
    ['Who wrote most of the Declaration of Independence?', 'Thomas Jefferson', 'George Washington', 'Benjamin Franklin', 'John Adams'],
    ['The first 10 amendments to the Constitution are called…', 'The Bill of Rights', 'The Preamble', 'The Articles of Confederation', 'The Federalist Papers'],
    ['How many U.S. senators are there?', '100', '50', '435', '538'],
    ['What are the three branches of the U.S. government?', 'Legislative, Executive, Judicial', 'Federal, State, Local', 'Senate, House, President', 'Army, Navy, Air Force'],
    ['Which ancient wonder is still standing?', 'Great Pyramid of Giza', 'Colossus of Rhodes', 'Hanging Gardens of Babylon', 'Lighthouse of Alexandria'],
    ['Who was president during the Civil War?', 'Abraham Lincoln', 'Ulysses S. Grant', 'Andrew Johnson', 'James Buchanan'],
    ['The Magna Carta was signed in…', 'England', 'France', 'Spain', 'Italy'],
    ['Who was the first person in space?', 'Yuri Gagarin', 'Neil Armstrong', 'John Glenn', 'Alan Shepard'],
    ['Which civilization built Machu Picchu?', 'Inca', 'Aztec', 'Maya', 'Olmec'],
    ['In what year did World War II end?', '1945', '1918', '1939', '1950'],
    ['How many justices sit on the U.S. Supreme Court?', '9', '7', '11', '12'],
    ['When did the Berlin Wall fall?', '1989', '1961', '1975', '1991'],
    ['Who invented the printing press around 1440?', 'Johannes Gutenberg', 'Leonardo da Vinci', 'Galileo', 'Isaac Newton'],
    ['Which amendment gave women the right to vote?', '19th', '15th', '13th', '21st'],
    ['How old must you be to become U.S. president?', '35', '30', '25', '40'],
  ]) });
  quiz({ id: 'sequences', title: 'Pattern Pro', emoji: '♾️', cat: 'brain', make: fromList([
    ['2, 3, 5, 7, 11, 13, ?', '17', '15', '19', '14'], ['1, 4, 9, 16, 25, ?', '36', '30', '35', '49'], ['1, 3, 6, 10, 15, ?', '21', '20', '18', '25'],
    ['2, 6, 12, 20, 30, ?', '42', '40', '36', '44'], ['1, 1, 2, 3, 5, 8, 13, ?', '21', '18', '20', '26'], ['3, 9, 27, 81, ?', '243', '162', '108', '324'],
    ['1, 8, 27, 64, ?', '125', '100', '81', '216'], ['1, 2, 6, 24, 120, ?', '720', '240', '600', '144'], ['100, 81, 64, 49, ?', '36', '25', '40', '30'],
    ['1, 2, 4, 7, 11, 16, ?', '22', '21', '20', '23'], ['7, 14, 28, 56, ?', '112', '84', '70', '128'], ['J, F, M, A, M, J, ?', 'J', 'A', 'S', 'D'],
    ['O, T, T, F, F, S, S, ?', 'E', 'N', 'T', 'O'], ['2, 5, 11, 23, 47, ?', '95', '94', '71', '96'], ['1, 11, 21, 1211, 111221, ?', '312211', '1112221', '122111', '311221'],
  ]) });
  // Math Blitz Pro: equations, powers, roots, percents — 60 seconds
  function proQ() {
    const k = rnd(5); let t, r;
    if (k === 0) { const x = rnd(15) - 5, a = 2 + rnd(8), b = rnd(30) - 10; t = `${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${a * x + b}  →  x = ?`; r = x; }
    else if (k === 1) { const a = 2 + rnd(4), n = 2 + rnd(a === 2 ? 7 : 3); t = `${a}^${n}`; r = a ** n; }
    else if (k === 2) { const a = 4 + rnd(17); t = `√${a * a}`; r = a; }
    else if (k === 3) { const p = [5, 10, 15, 20, 25, 30, 40, 50, 75][rnd(9)], n = 20 * (1 + rnd(20)); t = `${p}% of ${n}`; r = (p * n) / 100; }
    else { const a = -(2 + rnd(11)), b = (rnd(2) ? -1 : 1) * (2 + rnd(11)); t = `(${a}) × (${b})`; r = a * b; }
    const opts = new Set([r]); while (opts.size < 4) opts.add(r + (rnd(2) ? 1 : -1) * (1 + rnd(Math.max(3, Math.round(Math.abs(r) / 4)))));
    return { t: t.replace(/\^(\d)/, (m, d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]), r, opts: [...opts].sort(() => Math.random() - 0.5) };
  }
  add({
    id: 'mathpro', title: 'Math Blitz Pro', emoji: '🧮', cat: 'brain', dir: 'high', unit: 'right',
    init(ctx) { stopTimer(ctx.s); Object.assign(ctx.s, { state: 'ready', score: 0, left: 60, q: proQ(), flash: '' }); },
    stop(ctx) { stopTimer(ctx.s); },
    render(ctx) {
      const s = ctx.s;
      if (s.state === 'ready') return `<div class="panel stack center"><p class="idea">Equations, powers, roots &amp; percents.<br>60 seconds. Ready?</p>${bestPill(ctx)}${btn('go', '▶ Start', 'primary-button block big')}</div>`;
      if (s.state === 'done') return `<div class="panel stack center"><p class="big-win">${s.score} right!</p>${bestPill(ctx)}${btn('go', 'Play again', 'primary-button block')}</div>`;
      return `<div class="panel stack"><div class="row spread">${pill(`⏱ ${s.left}s`, s.left <= 10 ? 'st-declined' : '')}${pill(`Score: ${s.score}`, 'st-approved')}</div>
        <p class="center math-q pro ${s.flash}">${s.q.t}</p>
        <div class="quiz-opts two">${s.q.opts.map((o) => `<button class="quiz-opt center-text" data-act="gx" data-x="ans" data-v="${o}">${o}</button>`).join('')}</div></div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'go') {
        this.init(ctx); s.state = 'play';
        s.timer = setInterval(() => { if (!ctx.active()) return stopTimer(s); s.left--; if (s.left <= 0) { stopTimer(s); s.state = 'done'; ctx.best(s.score); if (s.score >= 15) ctx.confetti(); } ctx.paint(); }, 1000);
      }
      if (x === 'ans' && s.state === 'play') { const ok = Number(el.dataset.v) === s.q.r; if (ok) s.score++; s.flash = ok ? 'ok' : 'no'; ctx.beep(ok ? 880 : 180, 90); s.q = proQ(); }
      ctx.paint();
    },
  });

  // ================================================================ MATH BLITZ — 60 seconds
  function mathQ() {
    const op = rnd(3);
    let a, b, r, t;
    if (op === 0) { a = 2 + rnd(40); b = 2 + rnd(40); r = a + b; t = `${a} + ${b}`; }
    else if (op === 1) { a = 10 + rnd(60); b = 1 + rnd(a - 1); r = a - b; t = `${a} − ${b}`; }
    else { a = 2 + rnd(11); b = 2 + rnd(11); r = a * b; t = `${a} × ${b}`; }
    const opts = new Set([r]); while (opts.size < 4) opts.add(Math.max(0, r + (rnd(2) ? 1 : -1) * (1 + rnd(op === 2 ? 12 : 6))));
    return { t, r, opts: [...opts].sort(() => Math.random() - 0.5) };
  }
  add({
    id: 'math', title: 'Math Blitz', emoji: '➗', cat: 'quiz', dir: 'high', unit: 'right',
    init(ctx) { stopTimer(ctx.s); Object.assign(ctx.s, { state: 'ready', score: 0, left: 60, q: mathQ(), flash: '' }); },
    stop(ctx) { stopTimer(ctx.s); },
    render(ctx) {
      const s = ctx.s;
      if (s.state === 'ready') return `<div class="panel stack center"><p class="idea">60 seconds.<br>How many can you get?</p>${bestPill(ctx)}${btn('go', '▶ Start', 'primary-button block big')}</div>`;
      if (s.state === 'done') return `<div class="panel stack center"><p class="big-win">${s.score} right!</p>${bestPill(ctx)}${btn('go', 'Play again', 'primary-button block')}</div>`;
      return `<div class="panel stack"><div class="row spread">${pill(`⏱ ${s.left}s`, s.left <= 10 ? 'st-declined' : '')}${pill(`Score: ${s.score}`, 'st-approved')}</div>
        <p class="center math-q ${s.flash}">${s.q.t}</p>
        <div class="quiz-opts two">${s.q.opts.map((o) => `<button class="quiz-opt center-text" data-act="gx" data-x="ans" data-v="${o}">${o}</button>`).join('')}</div></div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'go') {
        this.init(ctx); s.state = 'play';
        s.timer = setInterval(() => { if (!ctx.active()) return stopTimer(s); s.left--; if (s.left <= 0) { stopTimer(s); s.state = 'done'; ctx.best(s.score); if (s.score >= 20) ctx.confetti(); } ctx.paint(); }, 1000);
      }
      if (x === 'ans' && s.state === 'play') { const ok = Number(el.dataset.v) === s.q.r; if (ok) s.score++; s.flash = ok ? 'ok' : 'no'; ctx.beep(ok ? 880 : 180, 90); s.q = mathQ(); }
      ctx.paint();
    },
  });

  // ================================================================ 2048
  function slide(row) {
    const v = row.filter(Boolean); let gained = 0;
    for (let i = 0; i < v.length - 1; i++) if (v[i] === v[i + 1]) { v[i] *= 2; gained += v[i]; v.splice(i + 1, 1); }
    while (v.length < 4) v.push(0);
    return [v, gained];
  }
  add({
    id: 'g2048', title: '2048', emoji: '🔢', cat: 'arcade', dir: 'high', unit: 'pts',
    init(ctx) { const s = ctx.s; s.b = Array(16).fill(0); s.score = 0; s.over = false; s.won = false; this.spawn(s); this.spawn(s); },
    spawn(s) { const free = s.b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0); if (free.length) s.b[free[rnd(free.length)]] = Math.random() < 0.9 ? 2 : 4; },
    move(s, dir) { // 0 left 1 right 2 up 3 down
      const b = s.b, before = b.join(); let gained = 0;
      for (let k = 0; k < 4; k++) {
        const idx = [0, 1, 2, 3].map((j) => (dir < 2 ? k * 4 + j : j * 4 + k)); if (dir === 1 || dir === 3) idx.reverse();
        const [row, g] = slide(idx.map((i) => b[i])); gained += g; idx.forEach((i, j) => { b[i] = row[j]; });
      }
      if (b.join() === before) return false;
      s.score += gained; this.spawn(s);
      if (!s.won && b.includes(2048)) s.won = true;
      const canMove = b.includes(0) || b.some((v, i) => (i % 4 < 3 && v === b[i + 1]) || (i < 12 && v === b[i + 4]));
      if (!canMove) s.over = true;
      return true;
    },
    render(ctx) {
      const s = ctx.s;
      return `<div class="panel stack"><div class="row spread">${pill(`Score: ${s.score}`, 'st-approved')}${bestPill(ctx)}</div>
        <p class="center small muted">Swipe the board (or use the arrows) — matching numbers join up!</p>
        <div class="g2048" data-swipe="1">${s.b.map((v) => `<div class="t2048 v${Math.min(v, 4096)}">${v || ''}</div>`).join('')}</div>
        ${s.over ? `<p class="center big-win">Game over — ${s.score} points!</p>` : s.won ? '<p class="center big-win">You made 2048! 🎉 Keep going!</p>' : ''}
        <div class="dpad">${btn('m2', '⬆️', 'ghost-button', 'aria-label="Up"')}<div class="row">${btn('m0', '⬅️', 'ghost-button', 'aria-label="Left"')}${btn('m3', '⬇️', 'ghost-button', 'aria-label="Down"')}${btn('m1', '➡️', 'ghost-button', 'aria-label="Right"')}</div></div>
        ${btn('again', s.over ? 'Play again' : 'Restart', 'ghost-button block')}</div>`;
    },
    swipe(dir, ctx) { const s = ctx.s; if (s.over) return; if (this.move(s, dir)) { if (s.over) ctx.best(s.score); ctx.paint(); } },
    act(x, el, ctx) { if (x[0] === 'm') return this.swipe(Number(x[1]), ctx); if (x === 'again') { if (ctx.s.score) ctx.best(ctx.s.score); this.init(ctx); } ctx.paint(); },
  });

  // ================================================================ SNAKE (canvas)
  const SN = 15;
  add({
    id: 'snake', title: 'Snake', emoji: '🐍', cat: 'arcade', dir: 'high', unit: 'apples',
    init(ctx) { stopTimer(ctx.s); Object.assign(ctx.s, { state: 'ready', body: [[7, 7], [6, 7], [5, 7]], dir: [1, 0], next: [1, 0], food: [11, 7], score: 0 }); },
    stop(ctx) { stopTimer(ctx.s); },
    render(ctx) {
      const s = ctx.s;
      return `<div class="panel stack"><div class="row spread">${pill(`🍎 ${s.score}`, 'st-approved')}${bestPill(ctx)}</div>
        <canvas class="snake-cv" width="300" height="300" data-swipe="1" aria-label="Snake board"></canvas>
        ${s.state === 'over' ? `<p class="center big-win">Game over — ${s.score} apples!</p>` : s.state === 'ready' ? '<p class="center small muted">Swipe or use the arrows to steer. Eat 🍎, don’t hit the walls or yourself!</p>' : ''}
        <div class="dpad">${btn('m2', '⬆️', 'ghost-button', 'aria-label="Up"')}<div class="row">${btn('m0', '⬅️', 'ghost-button', 'aria-label="Left"')}${btn('m3', '⬇️', 'ghost-button', 'aria-label="Down"')}${btn('m1', '➡️', 'ghost-button', 'aria-label="Right"')}</div></div>
        ${s.state !== 'play' ? btn('go', s.state === 'over' ? 'Play again' : '▶ Start', 'primary-button block') : ''}</div>`;
    },
    mount(root, ctx) { this.draw(ctx); },
    draw(ctx) {
      const cv = document.querySelector('.snake-cv'); if (!cv) return;
      const g = cv.getContext('2d'), c = 300 / SN, s = ctx.s, css = getComputedStyle(document.documentElement);
      g.fillStyle = css.getPropertyValue('--snake-bg').trim() || '#0b0020'; g.fillRect(0, 0, 300, 300);
      g.font = `${c * 0.9}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🍎', s.food[0] * c + c / 2, s.food[1] * c + c / 2 + 1);
      s.body.forEach(([x, y], i) => { g.fillStyle = i ? (css.getPropertyValue('--snake-body').trim() || '#19f58a') : (css.getPropertyValue('--snake-head').trim() || '#ffd400'); g.beginPath(); g.roundRect ? g.roundRect(x * c + 1, y * c + 1, c - 2, c - 2, 5) : g.rect(x * c + 1, y * c + 1, c - 2, c - 2); g.fill(); });
    },
    tick(ctx) {
      const s = ctx.s; if (!ctx.active()) return stopTimer(s);
      s.dir = s.next; const [hx, hy] = s.body[0], nx = hx + s.dir[0], ny = hy + s.dir[1];
      if (nx < 0 || ny < 0 || nx >= SN || ny >= SN || s.body.some(([x, y]) => x === nx && y === ny)) {
        stopTimer(s); s.state = 'over'; ctx.beep(140, 400); ctx.best(s.score); return ctx.paint();
      }
      s.body.unshift([nx, ny]);
      if (nx === s.food[0] && ny === s.food[1]) {
        s.score++; ctx.beep(660, 80);
        do { s.food = [rnd(SN), rnd(SN)]; } while (s.body.some(([x, y]) => x === s.food[0] && y === s.food[1]));
        const pl = document.querySelector('.snake-cv')?.closest('.panel')?.querySelector('.pill'); if (pl) pl.textContent = `🍎 ${s.score}`;
        stopTimer(s); s.timer = setInterval(() => this.tick(ctx), Math.max(70, 160 - s.score * 4));
      } else s.body.pop();
      this.draw(ctx);
    },
    swipe(dir, ctx) {
      const s = ctx.s, v = [[-1, 0], [1, 0], [0, -1], [0, 1]][dir];
      if (s.dir[0] === -v[0] && s.dir[1] === -v[1]) return; s.next = v;
      if (s.state !== 'play') this.act('go', null, ctx);
    },
    act(x, el, ctx) {
      if (x[0] === 'm') return this.swipe(Number(x[1]), ctx);
      if (x === 'go') { const keep = ctx.s.next; this.init(ctx); if (el === null && keep) ctx.s.next = keep; ctx.s.state = 'play'; ctx.s.timer = setInterval(() => this.tick(ctx), 160); }
      ctx.paint();
    },
  });

  // ================================================================ WHACK-A-MOLE — 30 seconds
  add({
    id: 'whack', title: 'Whack-a-Mole', emoji: '🔨', cat: 'arcade', dir: 'high', unit: 'moles',
    init(ctx) { stopTimer(ctx.s); Object.assign(ctx.s, { state: 'ready', score: 0, left: 30, mole: -1, hit: -1 }); },
    stop(ctx) { stopTimer(ctx.s); },
    render(ctx) {
      const s = ctx.s;
      return `<div class="panel stack"><div class="row spread">${pill(`⏱ ${s.left}s`)}${pill(`🔨 ${s.score}`, 'st-approved')}${bestPill(ctx)}</div>
        <div class="whack-grid">${Array.from({ length: 9 }, (_, i) => `<button class="hole ${s.mole === i ? 'up' : ''} ${s.hit === i ? 'bonk' : ''}" data-act="gx" data-x="hit" data-i="${i}" aria-label="Hole ${i + 1}">${s.hit === i ? '💥' : s.mole === i ? '🐹' : ''}</button>`).join('')}</div>
        ${s.state === 'done' ? `<p class="center big-win">${s.score} moles!</p>` : ''}
        ${s.state !== 'play' ? btn('go', s.state === 'done' ? 'Play again' : '▶ Start', 'primary-button block') : ''}</div>`;
    },
    pop(ctx) {
      const s = ctx.s; if (!ctx.active() || s.state !== 'play') return;
      let m; do { m = rnd(9); } while (m === s.mole); s.mole = m; s.hit = -1; ctx.paint();
      s.timeout = setTimeout(() => this.pop(ctx), Math.max(420, 900 - s.score * 15));
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'go') {
        this.init(ctx); s.state = 'play'; this.pop(ctx);
        s.timer = setInterval(() => { if (!ctx.active()) return stopTimer(s); s.left--; if (s.left <= 0) { stopTimer(s); s.state = 'done'; s.mole = -1; ctx.best(s.score); if (s.score >= 30) ctx.confetti(); } ctx.paint(); }, 1000);
      }
      if (x === 'hit' && s.state === 'play' && Number(el.dataset.i) === s.mole) { s.score++; s.hit = s.mole; s.mole = -1; ctx.beep(520, 70); }
      ctx.paint();
    },
  });

  // ================================================================ BALLOON POP — 20 seconds
  add({
    id: 'balloon', title: 'Balloon Pop', emoji: '🎈', cat: 'arcade', dir: 'high', unit: 'popped',
    init(ctx) { stopTimer(ctx.s); Object.assign(ctx.s, { state: 'ready', score: 0, left: 20, b: [], n: 0 }); },
    stop(ctx) { stopTimer(ctx.s); },
    render(ctx) {
      const s = ctx.s, colors = ['🎈', '🎈', '🎈', '💜', '⭐'];
      return `<div class="panel stack"><div class="row spread">${pill(`⏱ ${s.left}s`)}${pill(`🎈 ${s.score}`, 'st-approved')}${bestPill(ctx)}</div>
        <div class="sky">${s.b.map((b) => `<button class="balloon" style="left:${b.x}%;top:${b.y}%" data-act="gx" data-x="pop" data-id="${b.id}" aria-label="Balloon">${colors[b.id % colors.length]}</button>`).join('')}
          ${s.state !== 'play' ? `<div class="sky-msg">${s.state === 'done' ? `<b>${s.score} popped!</b>` : 'Pop as many as you can in 20 seconds!'}</div>` : ''}</div>
        ${s.state !== 'play' ? btn('go', s.state === 'done' ? 'Play again' : '▶ Start', 'primary-button block') : ''}</div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'go') {
        this.init(ctx); s.state = 'play';
        s.timer = setInterval(() => {
          if (!ctx.active()) return stopTimer(s);
          s.n++; if (s.n % 2 === 0) { s.left--; }
          if (s.left <= 0) { stopTimer(s); s.state = 'done'; s.b = []; ctx.best(s.score); if (s.score >= 40) ctx.confetti(); return ctx.paint(); }
          for (let k = 0; k < 2; k++) s.b.push({ id: s.n * 10 + k, x: 5 + rnd(80), y: 5 + rnd(75) });
          if (s.b.length > 7) s.b.splice(0, s.b.length - 7);
          ctx.paint();
        }, 500);
      }
      if (x === 'pop' && s.state === 'play') { const id = Number(el.dataset.id); if (s.b.some((b) => b.id === id)) { s.b = s.b.filter((b) => b.id !== id); s.score++; ctx.beep(900 + rnd(300), 50); } }
      ctx.paint();
    },
  });

  // ================================================================ COLOR CHALLENGE (Stroop) — 30 seconds
  const COLORS = [['RED', '#ff3b5c', 'Red'], ['BLUE', '#2f80ff', 'Blue'], ['GREEN', '#19c37d', 'Green'], ['YELLOW', '#f5c400', 'Yellow']];
  const stroopQ = () => { const w = rnd(4); let c; do { c = rnd(4); } while (c === w && Math.random() < 0.75); return { w, c }; };
  add({
    id: 'stroop', title: 'Color Challenge', emoji: '🎨', cat: 'arcade', dir: 'high', unit: 'right',
    init(ctx) { stopTimer(ctx.s); Object.assign(ctx.s, { state: 'ready', score: 0, left: 30, q: stroopQ(), flash: '' }); },
    stop(ctx) { stopTimer(ctx.s); },
    render(ctx) {
      const s = ctx.s;
      if (s.state !== 'play') return `<div class="panel stack center"><p>Tap the <b>color of the ink</b> — not the word! 🤯</p>
        ${s.state === 'done' ? `<p class="big-win">${s.score} right!</p>` : `<p class="stroop-word" style="color:${COLORS[2][1]}">RED</p><p class="small muted">Answer: Green</p>`}
        ${bestPill(ctx)}${btn('go', s.state === 'done' ? 'Play again' : '▶ Start', 'primary-button block')}</div>`;
      return `<div class="panel stack"><div class="row spread">${pill(`⏱ ${s.left}s`)}${pill(`Score: ${s.score}`, 'st-approved')}</div>
        <p class="stroop-word ${s.flash}" style="color:${COLORS[s.q.c][1]}">${COLORS[s.q.w][0]}</p>
        <div class="quiz-opts two">${COLORS.map((c, i) => `<button class="quiz-opt center-text" data-act="gx" data-x="ans" data-i="${i}">${c[2]}</button>`).join('')}</div></div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'go') {
        this.init(ctx); s.state = 'play';
        s.timer = setInterval(() => { if (!ctx.active()) return stopTimer(s); s.left--; if (s.left <= 0) { stopTimer(s); s.state = 'done'; ctx.best(s.score); if (s.score >= 25) ctx.confetti(); } ctx.paint(); }, 1000);
      }
      if (x === 'ans' && s.state === 'play') { const ok = Number(el.dataset.i) === s.q.c; s.score += ok ? 1 : 0; s.flash = ok ? 'ok' : 'no'; ctx.beep(ok ? 880 : 180, 80); s.q = stroopQ(); }
      ctx.paint();
    },
  });

  // ================================================================ TYPING RACE
  const SENTENCES = ['The quick brown fox jumps over the lazy dog.', 'Pizza parties are the best kind of parties.', 'My dog can catch a frisbee in midair.',
    'We built a giant blanket fort in the living room.', 'Summer break means sleeping in and swimming all day.', 'The rocket blasted off toward the bright full moon.',
    'Never trust a penguin wearing sunglasses.', 'Friends make every adventure more fun.', 'I practiced my dance moves in front of the mirror.', 'The pancakes were stacked as tall as a tower.'];
  add({
    id: 'typing', title: 'Typing Race', emoji: '⌨️', cat: 'arcade', dir: 'high', unit: 'WPM',
    init(ctx) { Object.assign(ctx.s, { text: ctx.pick(SENTENCES), typed: '', t0: 0, done: false, wpm: 0, acc: 100 }); },
    render(ctx) {
      const s = ctx.s, e = ctx.esc;
      const shown = [...s.text].map((ch, i) => `<span class="${i < s.typed.length ? (s.typed[i] === ch ? 'ok' : 'bad') : i === s.typed.length ? 'cur' : ''}">${e(ch)}</span>`).join('');
      return `<div class="panel stack"><div class="row spread">${pill('Type it as fast as you can!')}${bestPill(ctx, (v) => `${v} WPM`)}</div>
        <p class="type-target">${shown}</p>
        ${s.done ? `<p class="center big-win">${s.wpm} WPM</p><p class="center">${s.acc}% accurate ${s.acc >= 95 ? '🎯' : ''}</p>${btn('again', 'Next sentence', 'primary-button block')}`
          : `<input class="field type-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Start typing here…" aria-label="Type the sentence">`}</div>`;
    },
    mount(root, ctx) {
      const inp = root.querySelector('.type-input'); if (!inp) return;
      inp.value = ctx.s.typed;
      inp.addEventListener('input', () => {
        const s = ctx.s; if (s.done) return;
        if (!s.t0) s.t0 = performance.now();
        s.typed = inp.value.slice(0, s.text.length);
        const tgt = root.querySelector('.type-target');
        if (tgt) tgt.innerHTML = [...s.text].map((ch, i) => `<span class="${i < s.typed.length ? (s.typed[i] === ch ? 'ok' : 'bad') : i === s.typed.length ? 'cur' : ''}">${ctx.esc(ch)}</span>`).join('');
        if (s.typed.length >= s.text.length) {
          const mins = (performance.now() - s.t0) / 60000, right = [...s.typed].filter((c, i) => c === s.text[i]).length;
          s.acc = Math.round((right / s.text.length) * 100); s.wpm = Math.round((right / 5) / Math.max(mins, 0.01)); s.done = true;
          if (s.acc >= 80) ctx.best(Math.min(s.wpm, 250)); if (s.wpm >= 40) ctx.confetti(); ctx.paint();
        }
      });
      if (ctx.s.t0 || ctx.s.typed) inp.focus();
    },
    act(x, el, ctx) { if (x === 'again') this.init(ctx); ctx.paint(); },
  });

  // ================================================================ MINESWEEPER (8×8, 10 mines)
  const MW = 8, MINES = 10;
  add({
    id: 'mines', title: 'Minesweeper', emoji: '💣', cat: 'puzzle', dir: 'low', unit: 'sec',
    init(ctx) { stopTimer(ctx.s); Object.assign(ctx.s, { mines: null, open: new Set(), flags: new Set(), flagMode: false, over: false, won: false, t0: 0, secs: 0 }); },
    stop(ctx) { stopTimer(ctx.s); },
    layMines(s, safe) {
      const avoid = new Set([safe, ...this.nb(safe)]); s.mines = new Set();
      while (s.mines.size < MINES) { const c = rnd(MW * MW); if (!avoid.has(c)) s.mines.add(c); }
    },
    nb(c) { const r = Math.floor(c / MW), q = c % MW, out = []; for (let dr = -1; dr <= 1; dr++) for (let dq = -1; dq <= 1; dq++) { if (!dr && !dq) continue; const rr = r + dr, qq = q + dq; if (rr >= 0 && qq >= 0 && rr < MW && qq < MW) out.push(rr * MW + qq); } return out; },
    count(s, c) { return this.nb(c).filter((n) => s.mines.has(n)).length; },
    reveal(s, c) {
      const stack = [c];
      while (stack.length) { const x = stack.pop(); if (s.open.has(x) || s.flags.has(x)) continue; s.open.add(x); if (!s.mines.has(x) && !this.count(s, x)) stack.push(...this.nb(x)); }
    },
    render(ctx) {
      const s = ctx.s, nums = ['', '1', '2', '3', '4', '5', '6', '7', '8'];
      return `<div class="panel stack"><div class="row spread">${pill(`💣 ${MINES - s.flags.size}`)}${pill(`⏱ ${s.secs}s`)}${bestPill(ctx, (v) => `${v}s`)}</div>
        <div class="mine-grid">${Array.from({ length: MW * MW }, (_, c) => {
          const open = s.open.has(c), boom = open && s.mines?.has(c), n = open && !boom ? this.count(s, c) : 0;
          const show = boom ? '💥' : (s.over && s.mines?.has(c)) ? '💣' : s.flags.has(c) ? '🚩' : open ? nums[n] : '';
          return `<button class="mcell ${open ? 'open' : ''} n${n}" data-act="gx" data-x="cell" data-c="${c}" ${s.over || s.won ? 'disabled' : ''} aria-label="Square">${show}</button>`;
        }).join('')}</div>
        ${s.won ? `<p class="center big-win">You cleared it in ${s.secs}s! 🎉</p>` : s.over ? '<p class="center big-win">Boom! 💥 Try again?</p>' : ''}
        <div class="row">${btn('flag', s.flagMode ? '🚩 Flag mode: ON' : '⛏️ Dig mode', s.flagMode ? 'warm-button grow' : 'ghost-button grow')}${btn('again', 'New game', 'ghost-button grow')}</div></div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'again') this.init(ctx);
      if (x === 'flag') s.flagMode = !s.flagMode;
      if (x === 'cell' && !s.over && !s.won) {
        const c = Number(el.dataset.c);
        if (s.flagMode) { if (!s.open.has(c)) s.flags.has(c) ? s.flags.delete(c) : s.flags.add(c); }
        else if (!s.flags.has(c)) {
          if (!s.mines) { this.layMines(s, c); s.t0 = Date.now(); s.timer = setInterval(() => { if (!ctx.active()) return stopTimer(s); s.secs = Math.round((Date.now() - s.t0) / 1000); const p = document.querySelectorAll('.mine-grid')[0]?.closest('.panel')?.querySelectorAll('.pill')[1]; if (p) p.textContent = `⏱ ${s.secs}s`; }, 1000); }
          if (s.mines.has(c)) { s.open.add(c); s.over = true; stopTimer(s); ctx.beep(120, 500); }
          else { this.reveal(s, c); if (s.open.size === MW * MW - MINES) { s.won = true; stopTimer(s); s.secs = Math.max(1, Math.round((Date.now() - s.t0) / 1000)); ctx.best(Math.max(3, s.secs)); ctx.confetti(); } }
        }
      }
      ctx.paint();
    },
  });

  // ================================================================ GUESS THE WORD (hangman-style, solo)
  const HWORDS = [['Animal', ['ELEPHANT', 'GIRAFFE', 'PENGUIN', 'KANGAROO', 'OCTOPUS', 'CHEETAH', 'DOLPHIN', 'HAMSTER', 'SQUIRREL', 'BUTTERFLY']],
    ['Food', ['SPAGHETTI', 'PANCAKES', 'POPCORN', 'BURRITO', 'CUPCAKE', 'PRETZEL', 'WATERMELON', 'SANDWICH', 'LEMONADE', 'BLUEBERRY']],
    ['Place', ['LIBRARY', 'MOUNTAIN', 'ISLAND', 'STADIUM', 'MUSEUM', 'BEACH', 'JUNGLE', 'VOLCANO', 'CASTLE', 'PLAYGROUND']],
    ['Fun', ['TRAMPOLINE', 'SKATEBOARD', 'SLEEPOVER', 'CAMPFIRE', 'BIRTHDAY', 'FIREWORKS', 'KARAOKE', 'BASKETBALL', 'SNOWBALL', 'ROLLERCOASTER']]];
  const LIVES = 6;
  add({
    id: 'wordguess', title: 'Guess the Word', emoji: '🎈', cat: 'puzzle', dir: 'high', unit: 'in a row',
    init(ctx, keep) { const [cat, list] = ctx.pick(HWORDS); Object.assign(ctx.s, { cat, word: ctx.pick(list), g: [], streak: keep ? ctx.s.streak || 0 : 0 }); },
    render(ctx) {
      const s = ctx.s, miss = s.g.filter((l) => !s.word.includes(l)).length, solved = [...s.word].every((l) => s.g.includes(l)), lost = miss >= LIVES;
      return `<div class="panel stack"><div class="row spread">${pill(`Hint: ${s.cat}`)}${pill(`Streak: ${s.streak}`, 'st-approved')}${bestPill(ctx)}</div>
        <p class="center balloons" aria-label="${LIVES - miss} balloons left">${'🎈'.repeat(LIVES - miss)}${'💨'.repeat(miss)}</p>
        <div class="scr-slots ${solved ? 'solved' : lost ? 'wrong' : ''}">${[...s.word].map((l) => `<span>${s.g.includes(l) || lost ? l : ''}</span>`).join('')}</div>
        ${solved ? `<p class="center big-win">You got it! 🎉</p>${btn('next', 'Next word →', 'primary-button block')}`
          : lost ? `<p class="center">The word was <b>${s.word}</b></p>${btn('again', 'Try again', 'primary-button block')}`
            : `<div class="kbd">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `<button class="key ${s.g.includes(l) ? (s.word.includes(l) ? 'hit' : 'miss') : ''}" data-act="gx" data-x="l" data-l="${l}" ${s.g.includes(l) ? 'disabled' : ''}>${l}</button>`).join('')}</div>`}</div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'l' && !s.g.includes(el.dataset.l)) {
        s.g.push(el.dataset.l); ctx.beep(s.word.includes(el.dataset.l) ? 700 : 200, 70);
        if ([...s.word].every((l) => s.g.includes(l))) { s.streak++; ctx.best(s.streak); ctx.confetti(); }
      }
      if (x === 'next') this.init(ctx, true);
      if (x === 'again') this.init(ctx, false);
      ctx.paint();
    },
  });

  // ================================================================ CONNECT FOUR vs computer
  const CR = 6, CC = 7;
  function c4win(b, p) {
    const at = (r, c) => (r >= 0 && r < CR && c >= 0 && c < CC ? b[r * CC + c] : 0);
    for (let r = 0; r < CR; r++) for (let c = 0; c < CC; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) if ([0, 1, 2, 3].every((k) => at(r + dr * k, c + dc * k) === p)) return true;
    return false;
  }
  const c4drop = (b, c) => { for (let r = CR - 1; r >= 0; r--) if (!b[r * CC + c]) return r * CC + c; return -1; };
  add({
    id: 'connect4', title: 'Connect Four', emoji: '🔴', cat: 'puzzle', dir: 'high', unit: 'wins',
    init(ctx) { Object.assign(ctx.s, { b: Array(CR * CC).fill(0), over: null, wins: ctx.store.get('lh_c4_wins', 0) }); },
    cpu(b) {
      const cols = [3, 2, 4, 1, 5, 0, 6].filter((c) => c4drop(b, c) >= 0);
      for (const p of [2, 1]) for (const c of cols) { const t = [...b]; t[c4drop(t, c)] = p; if (c4win(t, p)) return c; }
      const safe = cols.filter((c) => { const t = [...b]; t[c4drop(t, c)] = 2; const above = c4drop(t, c); if (above < 0) return true; t[above] = 1; return !c4win(t, 1); });
      const pool = safe.length ? safe : cols;
      return Math.random() < 0.7 ? pool[0] : pool[rnd(pool.length)];
    },
    render(ctx) {
      const s = ctx.s;
      return `<div class="panel stack"><div class="row spread">${pill('You 🔴 vs 🤖 🟡')}${pill(`Wins: ${s.wins}`, 'st-approved')}</div>
        <p class="center"><b>${s.over === 1 ? 'You win! 🎉' : s.over === 2 ? 'Computer wins 🤖' : s.over === 3 ? "It's a tie!" : 'Tap a column to drop your piece'}</b></p>
        <div class="c4">${Array.from({ length: CC }, (_, c) => `<button class="c4col" data-act="gx" data-x="drop" data-c="${c}" ${s.over || c4drop(s.b, c) < 0 ? 'disabled' : ''} aria-label="Column ${c + 1}">${Array.from({ length: CR }, (_, r) => `<span class="c4cell p${s.b[r * CC + c]}"></span>`).join('')}</button>`).join('')}</div>
        ${btn('again', 'New game', 'ghost-button block')}</div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'again') this.init(ctx);
      if (x === 'drop' && !s.over) {
        const i = c4drop(s.b, Number(el.dataset.c)); if (i < 0) return;
        s.b[i] = 1; ctx.beep(500, 60);
        if (c4win(s.b, 1)) { s.over = 1; s.wins++; ctx.store.set('lh_c4_wins', s.wins); ctx.best(s.wins); ctx.confetti(); }
        else if (s.b.every(Boolean)) s.over = 3;
        else { const j = c4drop(s.b, this.cpu(s.b)); s.b[j] = 2; if (c4win(s.b, 2)) s.over = 2; else if (s.b.every(Boolean)) s.over = 3; }
      }
      ctx.paint();
    },
  });

  // ================================================================ LIGHTS OUT (5×5)
  add({
    id: 'lights', title: 'Lights Out', emoji: '💡', cat: 'puzzle', dir: 'low', unit: 'moves',
    flip(b, i) { const r = Math.floor(i / 5), c = i % 5; [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 5 && cc >= 0 && cc < 5) b[rr * 5 + cc] ^= 1; }); },
    init(ctx) { const s = ctx.s; s.b = Array(25).fill(0); s.moves = 0; s.won = false; do { for (let k = 0; k < 8; k++) this.flip(s.b, rnd(25)); } while (!s.b.some(Boolean)); },
    render(ctx) {
      const s = ctx.s;
      return `<div class="panel stack"><div class="row spread">${pill(`Moves: ${s.moves}`)}${bestPill(ctx)}</div>
        <p class="center small muted">Tapping a light flips it and its neighbors. Turn them ALL off!</p>
        <div class="lights">${s.b.map((v, i) => `<button class="light ${v ? 'on' : ''}" data-act="gx" data-x="t" data-i="${i}" ${s.won ? 'disabled' : ''} aria-label="${v ? 'On' : 'Off'}"></button>`).join('')}</div>
        ${s.won ? `<p class="center big-win">Lights out in ${s.moves} moves! 🌙</p>` : ''}${btn('again', s.won ? 'Play again' : 'New puzzle', 'ghost-button block')}</div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'again') this.init(ctx);
      if (x === 't' && !s.won) { this.flip(s.b, Number(el.dataset.i)); s.moves++; ctx.beep(440 + rnd(200), 40); if (!s.b.some(Boolean)) { s.won = true; ctx.best(s.moves); ctx.confetti(); } }
      ctx.paint();
    },
  });

  // ================================================================ SLIDE PUZZLE (3×3)
  add({
    id: 'slide', title: 'Slide Puzzle', emoji: '🧱', cat: 'puzzle', dir: 'low', unit: 'moves',
    adj(i) { const r = Math.floor(i / 3), c = i % 3; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && a < 3 && b >= 0 && b < 3).map(([a, b]) => a * 3 + b); },
    init(ctx) {
      const s = ctx.s; s.b = [1, 2, 3, 4, 5, 6, 7, 8, 0]; s.moves = 0; s.won = false; let last = -1;
      for (let k = 0; k < 120; k++) { const z = s.b.indexOf(0), opts = this.adj(z).filter((i) => i !== last); const m = opts[rnd(opts.length)]; [s.b[z], s.b[m]] = [s.b[m], s.b[z]]; last = z; }
      if (s.b.join() === '1,2,3,4,5,6,7,8,0') this.init(ctx);
    },
    render(ctx) {
      const s = ctx.s;
      return `<div class="panel stack"><div class="row spread">${pill(`Moves: ${s.moves}`)}${bestPill(ctx)}</div>
        <p class="center small muted">Tap a tile next to the gap to slide it. Put 1–8 in order!</p>
        <div class="slide">${s.b.map((v, i) => (v ? `<button class="stile" data-act="gx" data-x="mv" data-i="${i}" ${s.won ? 'disabled' : ''}>${v}</button>` : '<span class="stile gap"></span>')).join('')}</div>
        ${s.won ? `<p class="center big-win">Solved in ${s.moves} moves! 🧠</p>` : ''}${btn('again', s.won ? 'Play again' : 'Shuffle', 'ghost-button block')}</div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'again') this.init(ctx);
      if (x === 'mv' && !s.won) {
        const i = Number(el.dataset.i), z = s.b.indexOf(0);
        if (this.adj(z).includes(i)) { [s.b[z], s.b[i]] = [s.b[i], s.b[z]]; s.moves++; ctx.beep(600, 30); if (s.b.join() === '1,2,3,4,5,6,7,8,0') { s.won = true; ctx.best(s.moves); ctx.confetti(); } }
      }
      ctx.paint();
    },
  });

  // ================================================================ MINI SUDOKU (4×4)
  add({
    id: 'sudoku', title: 'Mini Sudoku', emoji: '🔲', cat: 'puzzle', dir: 'low', unit: 'sec',
    init(ctx) {
      stopTimer(ctx.s);
      const base = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1], perm = ctx.shuffle([1, 2, 3, 4]);
      let g = base.map((v) => perm[v - 1]);
      if (Math.random() < 0.5) g = Array.from({ length: 16 }, (_, i) => g[(i % 4) * 4 + Math.floor(i / 4)]); // transpose
      const holes = new Set(ctx.shuffle([...Array(16).keys()]).slice(0, 9));
      Object.assign(ctx.s, { sol: g, given: g.map((v, i) => !holes.has(i)), b: g.map((v, i) => (holes.has(i) ? 0 : v)), sel: [...holes][0], won: false, t0: Date.now() });
    },
    stop(ctx) { stopTimer(ctx.s); },
    bad(b, i) {
      const v = b[i]; if (!v) return false; const r = Math.floor(i / 4), c = i % 4, box = (Math.floor(r / 2) * 2) * 4 + Math.floor(c / 2) * 2;
      for (let k = 0; k < 4; k++) { if (r * 4 + k !== i && b[r * 4 + k] === v) return true; if (k * 4 + c !== i && b[k * 4 + c] === v) return true; }
      for (const j of [box, box + 1, box + 4, box + 5]) if (j !== i && b[j] === v) return true;
      return false;
    },
    render(ctx) {
      const s = ctx.s;
      return `<div class="panel stack"><div class="row spread">${pill('Fill 1–4: no repeats in a row, column or box')}${bestPill(ctx, (v) => `${v}s`)}</div>
        <div class="sudoku">${s.b.map((v, i) => `<button class="scell ${s.given[i] ? 'given' : ''} ${s.sel === i ? 'sel' : ''} ${this.bad(s.b, i) ? 'bad' : ''}" data-act="gx" data-x="sel" data-i="${i}" ${s.given[i] || s.won ? 'disabled' : ''}>${v || ''}</button>`).join('')}</div>
        ${s.won ? `<p class="center big-win">Solved in ${s.secs}s! 🧩</p>${btn('again', 'New puzzle', 'primary-button block')}`
          : `<div class="row">${[1, 2, 3, 4].map((n) => btn('num', n, 'primary-button grow', `data-n="${n}"`)).join('')}${btn('num', '⌫', 'ghost-button', 'data-n="0" aria-label="Erase"')}</div>`}</div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'again') this.init(ctx);
      if (x === 'sel') s.sel = Number(el.dataset.i);
      if (x === 'num' && s.sel != null && !s.given[s.sel] && !s.won) {
        s.b[s.sel] = Number(el.dataset.n);
        if (s.b.every((v, i) => v && !this.bad(s.b, i))) { s.won = true; s.secs = Math.max(5, Math.round((Date.now() - s.t0) / 1000)); ctx.best(s.secs); ctx.confetti(); }
        else { const nxt = s.b.findIndex((v, i) => !v && i > s.sel); if (s.b[s.sel] && nxt >= 0) s.sel = nxt; }
      }
      ctx.paint();
    },
  });

  // ================================================================ CODE BREAKER (Mastermind)
  const PEGS = ['🔴', '🟡', '🟢', '🔵', '🟣', '🟠'];
  add({
    id: 'codebreak', title: 'Code Breaker', emoji: '🔐', cat: 'puzzle', dir: 'low', unit: 'tries',
    init(ctx) { Object.assign(ctx.s, { code: Array.from({ length: 4 }, () => rnd(6)), rows: [], cur: [], done: false, won: false }); },
    score(code, g) {
      let exact = 0; const a = [], b = [];
      g.forEach((v, i) => { if (v === code[i]) exact++; else { a.push(code[i]); b.push(v); } });
      let near = 0; b.forEach((v) => { const k = a.indexOf(v); if (k >= 0) { near++; a.splice(k, 1); } });
      return [exact, near];
    },
    render(ctx) {
      const s = ctx.s;
      return `<div class="panel stack"><div class="row spread">${pill(`Try ${Math.min(s.rows.length + 1, 10)} of 10`)}${bestPill(ctx)}</div>
        <p class="center small muted">Crack the 4-color code! ⚫ = right color, right spot · ⚪ = right color, wrong spot</p>
        <div class="cb-rows">${s.rows.map((r) => `<div class="cb-row"><span>${r.g.map((v) => PEGS[v]).join('')}</span><span class="cb-fb">${'⚫'.repeat(r.f[0])}${'⚪'.repeat(r.f[1])}</span></div>`).join('')}
          ${!s.done ? `<div class="cb-row cur"><span>${[0, 1, 2, 3].map((i) => (s.cur[i] != null ? PEGS[s.cur[i]] : '◻️')).join('')}</span></div>` : ''}</div>
        ${s.done ? `<p class="center big-win">${s.won ? `Cracked in ${s.rows.length}! 🔓` : 'Locked out! 🔒'}</p><p class="center">The code was ${s.code.map((v) => PEGS[v]).join('')}</p>${btn('again', 'New code', 'primary-button block')}`
          : `<div class="row wrap center-row">${PEGS.map((p, i) => btn('peg', p, 'peg', `data-i="${i}" aria-label="Color ${i + 1}"`)).join('')}</div>
            <div class="row">${btn('back', '⌫ Undo', 'ghost-button grow')}${btn('try', 'Check ✔', 'primary-button grow', s.cur.length < 4 ? 'disabled' : '')}</div>`}</div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'again') this.init(ctx);
      if (x === 'peg' && s.cur.length < 4) s.cur.push(Number(el.dataset.i));
      if (x === 'back') s.cur.pop();
      if (x === 'try' && s.cur.length === 4) {
        const f = this.score(s.code, s.cur); s.rows.push({ g: s.cur, f }); s.cur = [];
        if (f[0] === 4) { s.done = s.won = true; ctx.best(s.rows.length); ctx.confetti(); } else if (s.rows.length >= 10) s.done = true;
      }
      ctx.paint();
    },
  });

  // ================================================================ NUMBER GUESS (1–100)
  add({
    id: 'numguess', title: 'Number Guess', emoji: '🎯', cat: 'puzzle', dir: 'low', unit: 'tries',
    init(ctx) { Object.assign(ctx.s, { n: 1 + rnd(100), tries: [], won: false, msg: 'I’m thinking of a number from 1 to 100…' }); },
    render(ctx) {
      const s = ctx.s;
      return `<div class="panel stack center"><div class="row spread">${pill(`Tries: ${s.tries.length}`)}${bestPill(ctx)}</div>
        <p class="idea">${s.msg}</p>
        ${s.tries.length ? `<p class="small muted">Your guesses: ${s.tries.join(', ')}</p>` : ''}
        ${s.won ? btn('again', 'Play again', 'primary-button block') : `<div class="row"><input class="field grow num-in" type="number" inputmode="numeric" min="1" max="100" placeholder="1–100" aria-label="Your guess">${btn('guess', 'Guess', 'primary-button')}</div>`}</div>`;
    },
    mount(root, ctx) { const inp = root.querySelector('.num-in'); if (inp) { inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.act('guess', null, ctx); } }); if (ctx.s.tries.length) inp.focus(); } },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'again') this.init(ctx);
      if (x === 'guess' && !s.won) {
        const v = Math.round(Number(document.querySelector('.num-in')?.value));
        if (!(v >= 1 && v <= 100)) { ctx.toast('Pick a number from 1 to 100'); return; }
        s.tries.push(v);
        if (v === s.n) { s.won = true; s.msg = `Yes! It was ${s.n}! 🎉`; ctx.best(s.tries.length); ctx.confetti(); }
        else s.msg = `${v} is too ${v < s.n ? 'low ⬆️' : 'high ⬇️'}${Math.abs(v - s.n) <= 5 ? ' — so close! 🔥' : ''}`;
      }
      ctx.paint();
    },
  });

  // ================================================================ ROCK PAPER SCISSORS
  const RPS = [['🪨', 'Rock'], ['📄', 'Paper'], ['✂️', 'Scissors']];
  add({
    id: 'rps', title: 'Rock Paper Scissors', emoji: '✂️', cat: 'fun', dir: 'high', unit: 'streak',
    init(ctx) { Object.assign(ctx.s, { me: null, cpu: null, res: '', w: 0, l: 0, t: 0, streak: 0 }); },
    render(ctx) {
      const s = ctx.s;
      return `<div class="panel stack center"><div class="row spread">${pill(`W ${s.w}`, 'st-approved')}${pill(`T ${s.t}`)}${pill(`L ${s.l}`, 'st-declined')}</div>
        <p class="rps-show">${s.me != null ? RPS[s.me][0] : '❔'} <span class="or">vs</span> ${s.cpu != null ? RPS[s.cpu][0] : '🤖'}</p>
        <p><b>${s.res || 'Pick one!'}</b> ${s.streak > 1 ? `· 🔥 ${s.streak} win streak` : ''}</p>${bestPill(ctx, (v) => `${v} in a row`)}
        <div class="row">${RPS.map(([e, n], i) => btn('p', `${e}<br><small>${n}</small>`, 'ghost-button grow rps-btn', `data-i="${i}"`)).join('')}</div></div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'p') {
        s.me = Number(el.dataset.i); s.cpu = rnd(3); const d = (s.me - s.cpu + 3) % 3;
        if (d === 0) { s.t++; s.res = 'Tie! 🤝'; } else if (d === 1) { s.w++; s.streak++; s.res = 'You win! 🎉'; ctx.best(s.streak); if (s.streak >= 3) ctx.confetti(); } else { s.l++; s.streak = 0; s.res = 'Computer wins 🤖'; }
      }
      ctx.paint();
    },
  });

  // ================================================================ HIGHER OR LOWER
  const CARD = (v) => ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][v];
  add({
    id: 'hilo', title: 'Higher or Lower', emoji: '🃏', cat: 'fun', dir: 'high', unit: 'streak',
    init(ctx) { Object.assign(ctx.s, { cur: 1 + rnd(13), suit: ctx.pick(['♥', '♦', '♣', '♠']), streak: 0, msg: '', over: false }); },
    render(ctx) {
      const s = ctx.s, red = s.suit === '♥' || s.suit === '♦';
      return `<div class="panel stack center"><div class="row spread">${pill(`Streak: ${s.streak}`, 'st-approved')}${bestPill(ctx)}</div>
        <div class="pcard ${red ? 'red' : ''}"><b>${CARD(s.cur)}</b><span>${s.suit}</span></div>
        <p><b>${s.msg || 'Will the next card be higher or lower?'}</b></p>
        ${s.over ? btn('again', 'Play again', 'primary-button block') : `<div class="row">${btn('hi', '⬆️ Higher', 'primary-button grow')}${btn('lo', '⬇️ Lower', 'warm-button grow')}</div>`}</div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'again') this.init(ctx);
      if ((x === 'hi' || x === 'lo') && !s.over) {
        const n = 1 + rnd(13), was = s.cur; s.cur = n; s.suit = ctx.pick(['♥', '♦', '♣', '♠']);
        if (n === was) s.msg = 'Same card — free pass! 😅';
        else if ((x === 'hi') === (n > was)) { s.streak++; s.msg = ctx.pick(['Yes! 🔥', 'Nice call! 🎯', 'Keep going! 🙌']); ctx.beep(760, 60); ctx.best(s.streak); }
        else { s.over = true; s.msg = `Nope — it was ${CARD(n)}. Streak: ${s.streak}`; ctx.beep(180, 300); }
      }
      ctx.paint();
    },
  });

  // ================================================================ MAGIC 8 BALL
  const EIGHT = ['Yes, definitely! ✨', 'Ask again later 🕐', 'Signs point to yes 👉', 'Hmm… not likely 🤔', 'Without a doubt! 💯', 'Better not tell you now 🤐', 'Totally! 🙌',
    'My sources say no 🙅', 'Outlook good 🌈', 'Concentrate and ask again 🧘', 'It is certain ✅', 'Very doubtful 😬', 'You can count on it 🤝', 'Maybe… 🤷'];
  add({
    id: 'magic8', title: 'Magic 8 Ball', emoji: '🎱', cat: 'fun',
    init(ctx) { Object.assign(ctx.s, { a: null, shake: false }); },
    render(ctx) {
      const s = ctx.s;
      return `<div class="panel stack center"><p class="small muted">Think of a yes-or-no question, then shake!</p>
        <button class="eight ${s.shake ? 'shake' : ''}" data-act="gx" data-x="shake" aria-label="Shake the 8 ball"><span>${s.a ? ctx.esc(s.a) : '8'}</span></button>
        ${btn('shake', '🔮 Shake it', 'primary-button block')}</div>`;
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'shake') { s.shake = true; s.a = null; ctx.paint(); setTimeout(() => { if (!ctx.active()) return; s.shake = false; s.a = ctx.pick(EIGHT); ctx.beep(520, 120); ctx.paint(); }, 700); return; }
      ctx.paint();
    },
  });

  // ================================================================ DOODLE PAD
  const INK = ['#111111', '#ff3b5c', '#ff9f1c', '#ffd400', '#19c37d', '#2f80ff', '#8b5cf6', '#ff5fa2', '#ffffff'];
  add({
    id: 'doodle', title: 'Doodle Pad', emoji: '🖍️', cat: 'fun',
    init(ctx) { Object.assign(ctx.s, { strokes: [], ink: INK[1], size: 6 }); },
    render(ctx) {
      const s = ctx.s;
      return `<div class="panel stack">
        <canvas class="doodle-cv" width="600" height="600" aria-label="Drawing area"></canvas>
        <div class="row wrap center-row">${INK.map((c) => `<button class="ink ${s.ink === c ? 'on' : ''}" style="background:${c}" data-act="gx" data-x="ink" data-c="${c}" aria-label="Color"></button>`).join('')}</div>
        <div class="row">${[3, 6, 14].map((z) => btn('size', z === 3 ? 'Thin' : z === 6 ? 'Medium' : 'Thick', s.size === z ? 'primary-button grow sm' : 'ghost-button grow sm', `data-z="${z}"`)).join('')}</div>
        <div class="row">${btn('undo', '↩️ Undo', 'ghost-button grow')}${btn('clear', '🗑️ Clear', 'ghost-button grow')}${btn('save', '💾 Save', 'warm-button grow')}</div></div>`;
    },
    mount(root, ctx) {
      const cv = root.querySelector('.doodle-cv'); if (!cv) return;
      const g = cv.getContext('2d'), s = ctx.s;
      const redraw = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 600); g.lineCap = g.lineJoin = 'round'; for (const st of s.strokes) { g.strokeStyle = st.c; g.lineWidth = st.z * 2; g.beginPath(); st.p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (st.p.length === 1) g.lineTo(st.p[0][0] + 0.1, st.p[0][1]); g.stroke(); } };
      redraw();
      const pt = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 600, ((e.clientY - r.top) / r.height) * 600]; };
      let cur = null;
      cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = { c: s.ink, z: s.size, p: [pt(e)] }; s.strokes.push(cur); redraw(); });
      cv.addEventListener('pointermove', (e) => { if (!cur) return; cur.p.push(pt(e)); redraw(); });
      const end = () => { cur = null; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    },
    act(x, el, ctx) {
      const s = ctx.s;
      if (x === 'ink') s.ink = el.dataset.c;
      if (x === 'size') s.size = Number(el.dataset.z);
      if (x === 'undo') s.strokes.pop();
      if (x === 'clear') s.strokes = [];
      if (x === 'save') { const cv = document.querySelector('.doodle-cv'); if (cv) { const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'my-doodle.png'; a.click(); } return; }
      ctx.paint();
    },
  });

  // ================================================================ swipe + keyboard for games that steer (2048, Snake)
  let sx = 0, sy = 0, swipeOn = false;
  document.addEventListener('touchstart', (e) => { const t = e.target.closest('[data-swipe]'); swipeOn = !!t; if (t) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
  document.addEventListener('touchmove', (e) => { if (swipeOn) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchend', (e) => {
    if (!swipeOn) return; swipeOn = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 1) : (dy < 0 ? 2 : 3);
    window.LH_GAME_SWIPE?.(dir);
  });
  document.addEventListener('keydown', (e) => {
    const dir = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3 }[e.key];
    if (dir == null || e.target.matches('input, textarea')) return;
    if (window.LH_GAME_SWIPE?.(dir)) e.preventDefault();
  });
})();
