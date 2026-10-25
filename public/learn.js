/* Let's Hang — "Future Me": career interest inventory, career planning, personal finance.
   app.js calls LH_LEARN.render(page, ctx) and LH_LEARN.act(action, el, ctx).
   ctx: { paint, esc, confetti, toast, get(), save(data), go(page) } — progress is saved per kid on this device. */
(() => {
  'use strict';
  const B = (x, label, cls = 'ghost-button', extra = '') => `<button class="${cls}" data-act="lx" data-x="${x}" ${extra}>${label}</button>`;
  const money = (n) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const pct = (n) => `${Math.round(n)}%`;

  // ================================================================ CAREER INTEREST INVENTORY (Holland / RIASEC style)
  const TYPES = {
    R: { name: 'Doer', long: 'Realistic', em: '🔧', color: '#ff7a00', about: 'You like hands-on work — building, fixing, being outdoors and seeing real results.',
      careers: [['Electrician', 'Apprenticeship (earn while you learn)'], ['Mechanic', 'Trade school or apprenticeship'], ['Carpenter', 'Apprenticeship'], ['Chef', 'Culinary school or on-the-job training'],
        ['Pilot', 'Flight school + licenses'], ['Park ranger', '4-year degree'], ['Firefighter', 'Fire academy + EMT training'], ['Veterinary technician', '2-year degree']],
      subjects: 'Tech ed / shop, science, PE, ag classes', try: 'Robotics, 4-H, Scouts, helping fix things at home, building kits' },
    I: { name: 'Thinker', long: 'Investigative', em: '🔬', color: '#2f80ff', about: 'You love figuring things out — science, puzzles, research and asking “why?”',
      careers: [['Doctor', '4-year degree + medical school + residency'], ['Scientist', '4-year degree, often more'], ['Software developer', 'Degree, bootcamp or self-taught + portfolio'], ['Engineer', '4-year degree'],
        ['Pharmacist', 'Doctor of Pharmacy degree'], ['Data scientist', '4-year degree, often more'], ['Meteorologist', '4-year degree'], ['Forensic scientist', '4-year degree']],
      subjects: 'Math, science, computer science', try: 'Science fair, coding clubs, math league, museum programs' },
    A: { name: 'Creator', long: 'Artistic', em: '🎨', color: '#ff16c7', about: 'You like making original things — art, music, writing, design and performing.',
      careers: [['Graphic designer', '2- or 4-year degree + portfolio'], ['Animator', 'Degree or art school + portfolio'], ['Musician', 'Lots of practice; music degree optional'], ['Writer / journalist', '4-year degree is common'],
        ['Architect', '5-year degree + license'], ['Photographer', 'Training + portfolio'], ['Video game designer', 'Degree or portfolio'], ['Fashion designer', 'Degree or design school']],
      subjects: 'Art, band/choir/orchestra, English, theater', try: 'Art club, band, drama, yearbook, making videos or comics' },
    S: { name: 'Helper', long: 'Social', em: '🤝', color: '#19c37d', about: 'You care about people — teaching, helping, healing and working on teams.',
      careers: [['Teacher', '4-year degree + license'], ['Nurse', '2- or 4-year nursing degree + license'], ['School counselor', "Master's degree"], ['Coach', 'Experience + certifications'],
        ['Physical therapist', 'Doctor of Physical Therapy'], ['Social worker', '4-year degree, often more'], ['Police officer', 'Police academy'], ['Speech therapist', "Master's degree"]],
      subjects: 'English, health, social studies, languages', try: 'Volunteering, tutoring, peer helpers, coaching younger kids' },
    E: { name: 'Leader', long: 'Enterprising', em: '🚀', color: '#f5c400', about: 'You like leading, convincing people and making things happen — big ideas and big goals.',
      careers: [['Business owner', 'Any path — skills + hustle'], ['Lawyer', '4-year degree + law school + bar exam'], ['Marketing manager', '4-year degree'], ['Real estate agent', 'Short course + license'],
        ['Sales manager', 'Experience; degree helps'], ['Event planner', 'Degree or experience'], ['Restaurant manager', 'Experience; degree helps'], ['Politician', 'Any path — start local!']],
      subjects: 'Speech, business, social studies, English', try: 'Student council, DECA/FBLA, starting a mini business, debate' },
    C: { name: 'Organizer', long: 'Conventional', em: '📊', color: '#8b5cf6', about: 'You like order, details and clear systems — numbers, plans and getting things exactly right.',
      careers: [['Accountant', '4-year degree (CPA license optional)'], ['Banker', '4-year degree is common'], ['Data analyst', '4-year degree'], ['Librarian', "Master's degree"],
        ['Office manager', 'Experience; degree helps'], ['Logistics planner', '2- or 4-year degree'], ['Insurance underwriter', '4-year degree'], ['Actuary', '4-year degree + exams']],
      subjects: 'Math, computer classes, business', try: 'Being a club treasurer, keeping score at games, organizing events' },
  };
  const QUESTIONS = [
    ['R', 'Build or fix things, like a bike or a birdhouse'], ['I', 'Do science experiments'], ['A', 'Draw, paint or design things'], ['S', 'Help a friend work through a problem'], ['E', 'Be the leader or captain of a group'], ['C', 'Organize your room, files or collections'],
    ['R', 'Work outside — on a farm, in a park or a forest'], ['I', 'Solve tricky math or logic puzzles'], ['A', 'Write stories, poems or songs'], ['S', 'Teach or tutor younger kids'], ['E', 'Start a small business, like selling crafts'], ['C', 'Keep track of money, points or scores'],
    ['R', 'Use tools or run machines'], ['I', 'Figure out why something happens'], ['A', 'Play an instrument or sing'], ['S', 'Volunteer to help people in your community'], ['E', 'Convince people to try your idea'], ['C', 'Follow clear step-by-step instructions'],
    ['R', 'Take apart gadgets to see how they work'], ['I', 'Learn how the human body works'], ['A', 'Act in a play or make videos'], ['S', 'Work on a team project'], ['E', 'Sell things at a fundraiser'], ['C', 'Make lists, schedules or spreadsheets'],
    ['R', 'Cook a meal from a recipe'], ['I', 'Code a computer program or game'], ['A', 'Design clothes, rooms or video game worlds'], ['S', 'Take care of someone who is sick or hurt'], ['E', 'Plan a big event or party'], ['C', 'Check work carefully for mistakes'],
    ['R', 'Take care of animals'], ['I', 'Read about space, dinosaurs or inventions'], ['A', 'Take creative photos'], ['S', 'Coach or cheer on a team'], ['E', 'Run for student council'], ['C', 'Sort and label things so they’re easy to find'],
  ];
  function inventory(ctx) {
    const d = ctx.get(), inv = d.inv || { i: 0, ans: [] };
    if (inv.i >= QUESTIONS.length) return results(ctx);
    const [, text] = QUESTIONS[inv.i];
    return `<div class="panel stack center">
      <div class="progress" aria-label="Question ${inv.i + 1} of ${QUESTIONS.length}"><i style="width:${(inv.i / QUESTIONS.length) * 100}%"></i></div>
      <p class="small muted">${inv.i + 1} of ${QUESTIONS.length} · There are no wrong answers!</p>
      <h3>Would you enjoy this?</h3><p class="inv-q">${ctx.esc(text)}</p>
      <div class="stack-sm">${B('ans', '😍 Love it!', 'quiz-opt center-text', 'data-v="2"')}${B('ans', '🙂 Maybe / sometimes', 'quiz-opt center-text', 'data-v="1"')}${B('ans', '😐 Not really me', 'quiz-opt center-text', 'data-v="0"')}</div>
      ${inv.i ? B('inv-back', '← Back', 'linkish small') : ''}</div>`;
  }
  function scoreInv(ans) {
    const sc = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    ans.forEach((v, i) => { sc[QUESTIONS[i][0]] += v; });
    const order = Object.keys(sc).sort((a, b) => sc[b] - sc[a]);
    return { sc, order, code: order.slice(0, 3).join('') };
  }
  function results(ctx) {
    const d = ctx.get(), { sc, order, code } = scoreInv(d.inv.ans), max = 12;
    const top = order.slice(0, 3);
    return `<div class="panel stack center tone-yellow"><p class="small muted">Your interest code</p><p class="inv-code">${top.map((k) => `<span style="--c:${TYPES[k].color}">${TYPES[k].em} ${k}</span>`).join('')}</p>
        <p><b>You're a ${top.map((k) => TYPES[k].name).join(' · ')}!</b></p><p class="small muted">This is about what you <i>enjoy</i> — not a test, and it can change as you grow. Try it again next year!</p></div>
      <div class="panel stack"><h3>All six interest areas</h3>${order.map((k) => `<div class="bar-row"><span>${TYPES[k].em} ${TYPES[k].name} <small>(${TYPES[k].long})</small></span><div class="bar"><i style="width:${(sc[k] / max) * 100}%;background:${TYPES[k].color}"></i></div></div>`).join('')}</div>
      ${top.map((k) => { const t = TYPES[k]; return `<div class="panel stack type-card" style="--c:${t.color}"><h3>${t.em} ${t.name} <small class="muted">· ${t.long}</small></h3><p>${t.about}</p>
        <p class="small"><b>Careers to explore:</b></p><div class="career-list">${t.careers.map(([n, edu]) => `<div class="career"><b>${n}</b><span>${edu}</span></div>`).join('')}</div>
        <p class="small"><b>Classes you might love:</b> ${t.subjects}</p><p class="small"><b>Try it now:</b> ${t.try}</p></div>`; }).join('')}
      <div class="panel stack"><p class="small">💡 Want to know what a job pays and how many jobs there will be? Look it up with a parent on the <b>Occupational Outlook Handbook</b> at <a href="https://www.bls.gov/ooh/" target="_blank" rel="noopener">bls.gov/ooh</a> — it's free and made by the U.S. government.</p>
        ${B('go', '📝 Build my career plan →', 'primary-button block', 'data-p="plan"')}${B('inv-redo', 'Take it again', 'ghost-button block')}</div>`;
  }

  // ================================================================ LESSONS (career + money) — short cards, then a 3-question check
  const LESSONS = {
    career: [
      { id: 'c1', em: '🧭', title: 'Job vs. career', cards: [
        'A <b>job</b> is work you do to earn money — like mowing lawns or working at a store.',
        'A <b>career</b> is the path of work you build over many years. It can include lots of different jobs!',
        'Great careers usually mix three things: your <b>interests</b> (what you enjoy), your <b>skills</b> (what you’re good at) and your <b>values</b> (what matters to you — like helping people, creativity or money).',
        'Most adults change jobs many times. Your career can twist and turn — and that’s normal.'],
        quiz: [['A career is…', 'The path of work you build over time', 'One job you do forever', 'Only jobs that need college'],
          ['Which is a “value”?', 'Wanting to help people', 'Being good at math', 'Liking soccer'], ['Is it normal to change jobs during your life?', 'Yes — most people do', 'No, never', 'Only if you get fired']] },
      { id: 'c2', em: '🛤️', title: 'Paths after high school', cards: [
        '<b>4-year college</b> — a bachelor’s degree for careers like teaching, engineering or accounting.',
        '<b>Community college</b> — 2-year degrees and certificates. Often costs much less, and you can transfer to a 4-year school later.',
        '<b>Trade school & apprenticeships</b> — learn a skilled trade like electrician, plumber or welder. Apprentices <i>earn money while they learn</i>!',
        '<b>Military</b> — serve your country and get training (and help paying for college).',
        '<b>Start working or start a business</b> — some people learn on the job or build their own company. Every path can lead to a great career!'],
        quiz: [['Which path lets you earn money while you learn a trade?', 'An apprenticeship', 'A 4-year degree', 'Summer break'],
          ['Community college degrees usually take about…', '2 years', '8 years', '6 months'], ['Is college the only path to a good career?', 'No — there are many paths', 'Yes, always', 'Only for doctors']] },
      { id: 'c3', em: '💪', title: 'Skills every job wants', cards: [
        'Employers say the most important skills aren’t just facts — they’re <b>people skills</b>: showing up on time, communicating, teamwork and solving problems.',
        '<b>Communication:</b> speak clearly, listen well, write a polite email.',
        '<b>Teamwork:</b> share the work, respect ideas, keep promises to your group.',
        '<b>Problem solving:</b> when something goes wrong, try ideas instead of giving up.',
        'You can practice ALL of these right now — in group projects, sports, clubs and chores.'],
        quiz: [['Which is a “people skill” employers want?', 'Being reliable and on time', 'Knowing every capital city', 'Having the newest phone'],
          ['Where can you practice teamwork now?', 'Group projects, sports and clubs', 'Only at a real job', 'Nowhere until you’re 18'], ['When something goes wrong, a problem-solver…', 'Tries different ideas', 'Quits right away', 'Blames others']] },
      { id: 'c4', em: '🧩', title: 'Middle school moves', cards: [
        '<b>Explore!</b> Try new clubs, electives and activities. You learn what you like by trying things.',
        '<b>Talk to adults</b> about their jobs: “What do you do all day? What do you like? How did you get there?”',
        '<b>Volunteer</b> — it builds skills and shows you new kinds of work.',
        '<b>Keep a brag sheet:</b> a list of awards, activities, volunteer hours and things you’re proud of. You’ll use it for high school, jobs and scholarships.',
        '<b>Plan your high school classes</b> with your counselor — some careers need certain classes (like more math or science).'],
        quiz: [['A “brag sheet” is…', 'A list of your activities and wins', 'A way to show off online', 'A school detention form'],
          ['A good question to ask an adult about their job is…', '“How did you get into your job?”', '“How much money do you have?”', '“Why is your job boring?”'], ['Who can help you plan high school classes?', 'Your school counselor', 'Nobody', 'Only your friends']] },
      { id: 'c5', em: '🎯', title: 'Set SMART goals', cards: [
        'Big dreams become real with good goals. Use <b>SMART</b> goals:',
        '<b>S</b>pecific — what exactly? <b>M</b>easurable — how will you know you did it? <b>A</b>chievable — is it realistic?',
        '<b>R</b>elevant — does it matter to you? <b>T</b>ime-bound — by when?',
        '❌ “Get better at art.” ✅ “Finish one drawing every week until winter break.”'],
        quiz: [['Which goal is SMART?', 'Read 2 books about space by March 1', 'Be smarter', 'Do cool stuff someday'],
          ['The “T” in SMART stands for…', 'Time-bound', 'Tricky', 'Teamwork'], ['Why make goals measurable?', 'So you know when you’ve reached them', 'So they sound fancy', 'So they take longer']] },
    ],
    money: [
      { id: 'm1', em: '💵', title: 'Earning money', cards: [
        'People earn money by trading their <b>time and skills</b> for pay — from allowance and chores to pet-sitting, babysitting or starting a mini business.',
        'When you get a job, your <b>gross pay</b> is what you earn. Your <b>net pay</b> (take-home pay) is what’s left after <b>taxes</b> come out.',
        'Taxes pay for things we all share — roads, schools, parks, firefighters.',
        'More skills and training usually means you can earn more per hour. Learning = earning!'],
        quiz: [['Net pay is…', 'What you take home after taxes', 'What you earn before taxes', 'Money you owe'],
          ['Taxes help pay for…', 'Roads, schools and parks', 'Your video games', 'Nothing'], ['What usually helps people earn more?', 'More skills and training', 'Luck only', 'Spending more']] },
      { id: 'm2', em: '🛒', title: 'Needs vs. wants', cards: [
        '<b>Needs</b> are things you must have to live and be safe: food, a place to live, basic clothes, healthcare.',
        '<b>Wants</b> are things that are nice to have: a new game, name-brand shoes, snacks, concert tickets.',
        'Smart money rule: cover your <b>needs first</b>, then plan for wants.',
        'Some things are tricky — you <i>need</i> shoes, but you <i>want</i> the $200 pair. That extra cost is a want!'],
        quiz: [['Which is a NEED?', 'Groceries', 'A video game', 'Concert tickets'], ['Which is a WANT?', 'Designer sneakers', 'Medicine', 'Rent'],
          ['What should you pay for first?', 'Needs', 'Wants', 'Whatever is on sale']], game: true },
      { id: 'm3', em: '🫙', title: 'Make a budget', cards: [
        'A <b>budget</b> is a plan that tells your money where to go — before you spend it.',
        'A simple kid budget is <b>Spend · Save · Give</b>. For example: 50% spend, 40% save, 10% give.',
        'Many adults use the <b>50/30/20 rule</b>: 50% needs, 30% wants, 20% savings.',
        'If you spend more than you earn, you’ll run out — or end up in debt. A budget helps you avoid that.'],
        quiz: [['A budget is…', 'A plan for your money', 'A kind of bank', 'A bill you owe'], ['In the 50/30/20 rule, the 20% is for…', 'Savings', 'Wants', 'Needs'],
          ['If you spend more than you earn…', 'You run out or go into debt', 'Nothing happens', 'The bank pays for it']], tool: 'budget' },
      { id: 'm4', em: '🌱', title: 'Saving & compound interest', cards: [
        'Saving means keeping money for later — for a goal, or for emergencies.',
        'When you save in a bank, it pays you <b>interest</b> — a little extra money for keeping your money there.',
        '<b>Compound interest</b> is interest on your interest. Your money grows faster and faster over time — like a snowball rolling downhill. ⛄',
        'The secret ingredient is <b>time</b>. Starting young makes a HUGE difference.',
        '<b>Rule of 72:</b> divide 72 by the interest rate to estimate how many years it takes to double your money. At 6%, about 12 years!'],
        quiz: [['Compound interest is…', 'Interest earned on your interest', 'A bank fee', 'Money you owe'], ['What makes compound interest most powerful?', 'Time', 'Spending', 'Luck'],
          ['Using the Rule of 72, money at 8% doubles in about…', '9 years', '72 years', '8 years']], tool: 'grow' },
      { id: 'm5', em: '🏦', title: 'Banks, debit & credit', cards: [
        'A <b>savings account</b> is for money you’re keeping. A <b>checking account</b> is for money you spend and pay bills with.',
        'In the U.S., bank deposits are usually protected by the <b>FDIC</b> — up to $250,000 per person, per bank — even if the bank fails.',
        'A <b>debit card</b> spends money that’s already in your account.',
        'A <b>credit card</b> borrows money you must pay back. If you don’t pay it all each month, you pay <b>interest</b> — and it can add up fast.',
        'Never share your PIN or passwords — not even with friends.'],
        quiz: [['A debit card uses…', 'Money already in your account', 'Borrowed money', 'Free money'], ['If you don’t pay your credit card bill in full…', 'You pay interest', 'It’s forgiven', 'You get a reward'],
          ['Who should know your PIN?', 'Only you (and maybe your parent)', 'Your friends', 'Anyone who asks']], tool: 'credit' },
      { id: 'm6', em: '🧾', title: 'Borrowing & credit scores', cards: [
        'When you borrow money, you pay back more than you borrowed — the extra is <b>interest</b>. The yearly cost is the <b>APR</b>.',
        'A <b>credit score</b> (usually 300–850) shows how reliably you pay back money. Higher is better.',
        'Good scores help you rent apartments, get car loans and pay less interest.',
        'Best habits: pay on time, every time; don’t borrow more than you can pay back.'],
        quiz: [['APR tells you…', 'The yearly cost of borrowing', 'Your bank balance', 'Your allowance'], ['A higher credit score is…', 'Better', 'Worse', 'Doesn’t matter'],
          ['The #1 habit for good credit is…', 'Paying on time', 'Getting lots of cards', 'Never checking your bills']] },
      { id: 'm10', em: '🚗', title: 'Finance charges: cars, homes & school', cards: [
        'A <b>finance charge</b> is the total cost of borrowing money — all the interest and fees you pay on top of what you borrowed.',
        'Big things are usually bought with a <b>loan</b>: a <b>car loan</b> (often 3–6 years), a <b>mortgage</b> for a home (often 15 or 30 years) or a <b>student loan</b> for college.',
        'You pay loans back in <b>monthly payments</b>. Early payments are mostly interest; later payments are mostly paying off the loan itself (the <b>principal</b>).',
        '<b>Three ways to pay less:</b> 1) a bigger <b>down payment</b> (borrow less), 2) a lower <b>interest rate</b> (good credit helps!), 3) a <b>shorter loan</b> — higher monthly payment, but much less interest overall.',
        'Example: a $240,000 mortgage at 6.5% costs about <b>$306,000 in interest over 30 years</b> — but about <b>$136,000 over 15 years</b>. Same house, very different finance charge!',
        'Credit cards often have the highest rates of all — usually 20% or more. Paying the full bill every month means <b>no finance charge</b>.'],
        quiz: [['A finance charge is…', 'The total cost of borrowing — interest plus fees', 'The price of the car', 'Your monthly allowance'],
          ['Which usually means LESS total interest?', 'A shorter loan', 'A longer loan', 'A smaller down payment'],
          ['A down payment is…', 'Money you pay up front so you borrow less', 'A late fee', 'The last payment of a loan']], tool: 'loan' },
      { id: 'm7', em: '🏷️', title: 'Smart shopping', cards: [
        'Compare prices before you buy. Check the <b>unit price</b> — the price per ounce or per item — to find the real deal.',
        'Stores use tricks: “limited time!”, candy at the checkout, prices like $9.99 instead of $10.',
        'Games use tricks too: in-app purchases, loot boxes and special coins make it easy to spend real money without noticing.',
        'Try the <b>24-hour rule</b>: wait a day before buying a want. If you still want it, it’s probably worth it.'],
        quiz: [['The unit price helps you…', 'Compare the real cost of items', 'Pay with credit', 'Earn interest'], ['Why do games use special coins?', 'So spending feels less like real money', 'Because it’s cheaper', 'To help you save'],
          ['The 24-hour rule means…', 'Wait a day before buying a want', 'Shop only at night', 'Spend it all in one day']] },
      { id: 'm8', em: '🛡️', title: 'Scams & online money safety', cards: [
        '<b>Too good to be true?</b> It probably is. “You won a free phone!” is usually a scam.',
        'Real companies and the government will <b>never</b> ask you to pay with <b>gift cards</b>. Anyone who does is a scammer.',
        'Never share passwords, PINs or codes sent to your phone — that’s how accounts get stolen.',
        'Free game currency generators and “give me your login and I’ll give you skins” are scams.',
        'If something feels off, stop and tell a trusted adult. 🙋'],
        quiz: [['Someone says you won a prize but must pay with gift cards. This is…', 'A scam', 'A normal contest', 'A bank rule'],
          ['Should you share a code texted to your phone?', 'No — never', 'Yes, if they ask nicely', 'Only to strangers'], ['If something online feels wrong, you should…', 'Stop and tell a trusted adult', 'Keep clicking', 'Send money quickly']] },
      { id: 'm9', em: '📈', title: 'Investing basics', cards: [
        'Investing means putting money into something that can <b>grow</b> over time.',
        'A <b>stock</b> is a tiny piece of ownership in a company. If the company does well, your piece can be worth more — but it can also go down.',
        '<b>Risk and reward</b> go together: things that can grow more can also lose more.',
        '<b>Diversify</b> — don’t put all your eggs in one basket. Many people use <b>index funds</b>, which own small pieces of hundreds of companies at once.',
        'Investing works best over <b>many years</b>. Anything promising to make you rich fast is a red flag. 🚩'],
        quiz: [['A stock is…', 'A small piece of a company', 'A kind of loan', 'A savings account'], ['Diversifying means…', 'Spreading money across many investments', 'Putting it all in one company', 'Keeping cash under your bed'],
          ['A promise to “get rich quick” is…', 'A red flag', 'A great deal', 'Guaranteed']] },
    ],
    market: [
      { id: 's1', em: '🏪', title: 'What is a market?', cards: [
        'A <b>market</b> is anywhere buyers and sellers trade — a farmers market, an online store, or the stock market.',
        'Prices come from <b>supply and demand</b>. If lots of people want something and there isn’t much of it, the price goes <b>up</b>. If nobody wants it, the price goes <b>down</b>.',
        'Example: a limited sneaker drop. Only 500 pairs + thousands of fans = resale prices way above the store price.',
        'The <b>stock market</b> works the same way — but people are buying and selling tiny pieces of companies.'],
        quiz: [['If demand goes up and supply stays the same, the price usually…', 'Goes up', 'Goes down', 'Stays exactly the same'],
          ['A market is…', 'A place where buyers and sellers trade', 'Only a grocery store', 'A type of bank'], ['Prices are set mostly by…', 'Supply and demand', 'The president', 'Random luck']] },
      { id: 's2', em: '🗽', title: 'Free enterprise & capitalism', cards: [
        'The U.S. has a <b>free enterprise</b> (or <b>capitalist</b>) economy: people and businesses can own property, start companies, choose jobs and keep the profits they earn.',
        '<b>Capital</b> means the money, tools and buildings used to make more stuff — like a pizza oven, a factory or a laptop for coding.',
        '<b>Entrepreneurs</b> take a risk to start businesses. If customers like what they make, they earn a <b>profit</b>. If not, they can lose money.',
        '<b>Competition</b> pushes businesses to make better products at better prices — good for customers!',
        'The government still sets rules — like safety laws and fair competition — so the U.S. is called a <b>mixed economy</b>.'],
        quiz: [['In free enterprise, who can start a business?', 'Almost anyone', 'Only the government', 'Only banks'],
          ['“Capital” means…', 'Money and tools used to make more goods', 'The capital city', 'A capital letter'], ['Competition usually leads to…', 'Better products and prices', 'Higher prices for everything', 'Fewer choices']] },
      { id: 's3', em: '📄', title: 'What is a stock?', cards: [
        'A <b>stock</b> (or <b>share</b>) is a tiny piece of ownership in a company. Own 1 share of Nike and you own a teeny piece of Nike!',
        'Companies sell shares to raise money to grow. The first time is called an <b>IPO</b> (initial public offering).',
        'Shares trade on <b>stock exchanges</b> like the <b>New York Stock Exchange (NYSE)</b> and <b>Nasdaq</b>. Each company has a short <b>ticker symbol</b> — Apple is AAPL, Disney is DIS.',
        'People buy and sell through a <b>broker</b> (often an app). The U.S. market is open <b>Monday–Friday, 8:30 AM–3:00 PM Central</b>, except holidays.',
        'Many apps let you buy <b>fractional shares</b> — part of one share — so you don’t need hundreds of dollars to start.'],
        quiz: [['Owning a share means you…', 'Own a small piece of the company', 'Work for the company', 'Lent the company money'],
          ['AAPL and DIS are examples of…', 'Ticker symbols', 'Bank accounts', 'Credit scores'], ['When is the U.S. stock market open?', 'Weekdays during the day', 'Only on weekends', '24 hours, 7 days a week']] },
      { id: 's4', em: '🎢', title: 'Why prices go up and down', cards: [
        'A stock’s price is just the last price a buyer and seller agreed on. More buyers than sellers → price rises. More sellers → price falls.',
        'Big movers: <b>earnings</b> (how much profit a company made), <b>news</b> (a new product, a lawsuit) and <b>expectations</b> (what people think will happen next).',
        'Sometimes good news still makes a stock drop — because investors expected even <i>better</i> news!',
        'Day to day, prices bounce around a lot. Nobody can reliably predict short-term moves — not even experts.'],
        quiz: [['If more people want to sell a stock than buy it, the price…', 'Falls', 'Rises', 'Doesn’t change'],
          ['“Earnings” are…', 'A company’s profits', 'Your allowance', 'The stock’s name'], ['Can anyone reliably predict tomorrow’s stock price?', 'No', 'Yes, experts always can', 'Yes, with an app']] },
      { id: 's5', em: '🐂', title: 'Indexes, bulls & bears', cards: [
        'An <b>index</b> tracks a group of stocks to show how “the market” is doing. The <b>S&P 500</b> follows 500 big U.S. companies. The <b>Dow Jones</b> follows 30 big companies.',
        'A <b>bull market</b> 🐂 is when prices rise for a long time. A <b>bear market</b> 🐻 is when prices fall 20% or more from their high.',
        'Over many decades, the U.S. stock market has gone up overall — but with scary drops along the way, like in 2008 and 2020.',
        'Past results don’t guarantee the future. That’s why investing is for money you won’t need for a long time.'],
        quiz: [['The S&P 500 tracks…', '500 big U.S. companies', '500 banks', 'The 500 richest people'],
          ['A bear market is…', 'When prices fall 20% or more', 'When prices rise fast', 'A zoo for investors'], ['Investing in stocks is best for money you…', 'Won’t need for a long time', 'Need next week', 'Owe someone']] },
      { id: 's6', em: '🧺', title: 'Dividends, risk & diversifying', cards: [
        'Some companies share profits with owners as <b>dividends</b> — cash paid to you just for holding the stock.',
        '<b>Risk</b>: a single company can have a terrible year. If all your money is in one stock, you can lose a lot.',
        '<b>Diversify</b>: spread money across many companies. An <b>index fund</b> (like one that tracks the S&P 500) owns hundreds of companies at once.',
        '<b>Time in the market</b> usually beats <b>timing the market</b> — trying to guess the perfect moment to buy and sell rarely works.'],
        quiz: [['A dividend is…', 'Cash a company pays its shareholders', 'A fee you pay to trade', 'A type of loan'],
          ['Diversifying means…', 'Spreading money across many investments', 'Buying just one stock', 'Selling everything'], ['Which usually works better?', 'Investing for a long time', 'Guessing the perfect day to buy and sell', 'Trading every minute']] },
      { id: 's7', em: '📊', title: 'How to read a stock quote', cards: [
        '<b>Price</b> — what one share costs right now. <b>Change</b> — how much it moved today, in dollars and percent (green = up, red = down).',
        '<b>Previous close</b> — yesterday’s final price. <b>Open</b> — today’s first price. <b>Day range</b> — today’s lowest and highest price.',
        'Your <b>cost basis</b> is what you paid. If the price is now higher, you have a <b>gain</b>; lower, a <b>loss</b>.',
        'Gains and losses are “on paper” until you sell. Real investors also pay <b>taxes</b> on profits when they sell.'],
        quiz: [['A stock shows “+2.5%” in green. It…', 'Went up 2.5% today', 'Went down 2.5%', 'Pays 2.5% interest'],
          ['“Previous close” is…', 'Yesterday’s final price', 'The price next week', 'The highest price ever'], ['Your “cost basis” is…', 'What you paid for your shares', 'Today’s price', 'The company’s profit']] },
    ],
  };
  const allLessons = () => [...LESSONS.career, ...LESSONS.money, ...LESSONS.market];
  const findLesson = (id) => allLessons().find((l) => l.id === id);

  function lessonView(ctx, id) {
    const L = findLesson(id), d = ctx.get(), st = d.ls?.[id] || { card: 0 };
    if (st.card < L.cards.length) return `<div class="panel stack lesson">
        <div class="progress"><i style="width:${(st.card / (L.cards.length + 1)) * 100}%"></i></div>
        <p class="lesson-em" aria-hidden="true">${L.em}</p><p class="lesson-card">${L.cards[st.card]}</p>
        <div class="row">${st.card ? B('card-back', '← Back', 'ghost-button grow', `data-l="${id}"`) : ''}${B('card-next', st.card + 1 < L.cards.length ? 'Next →' : 'Quick check ✓', 'primary-button grow', `data-l="${id}"`)}</div>
        <p class="small muted center">${st.card + 1} of ${L.cards.length}</p></div>`;
    const qi = st.q || 0;
    if (qi < L.quiz.length) {
      const [q, right, ...wrong] = L.quiz[qi], opts = st.opts?.[qi] || [right, ...wrong];
      return `<div class="panel stack"><div class="row spread"><span class="pill">Question ${qi + 1} of ${L.quiz.length}</span><span class="pill st-approved">${st.right || 0} right</span></div>
        <h3>${q}</h3><div class="quiz-opts">${opts.map((o) => { const s = st.picked == null ? '' : o === right ? 'right' : o === st.picked ? 'wrong' : ''; return `<button class="quiz-opt ${s}" data-act="lx" data-x="lq" data-l="${id}" data-o="${ctx.esc(o)}" ${st.picked != null ? 'disabled' : ''}>${o}</button>`; }).join('')}</div>
        ${st.picked != null ? `<p class="center"><b>${st.picked === right ? 'Correct! ✅' : `Not quite — it’s “${right}”`}</b></p>${B('lq-next', qi + 1 < L.quiz.length ? 'Next →' : 'Finish', 'primary-button block', `data-l="${id}"`)}` : ''}</div>`;
    }
    const tool = L.tool ? `${B('go', `🛠️ Try the ${{ budget: 'Budget Builder', grow: 'Money Grower', credit: 'Credit Card Calculator', loan: 'Loan Lab' }[L.tool]}`, 'warm-button block', `data-p="tool-${L.tool}"`)}` : '';
    const game = L.game ? B('go', '🎮 Play Needs vs. Wants', 'warm-button block', 'data-p="needs"') : '';
    return `<div class="panel stack center"><p class="lesson-em">🏅</p><h3>Lesson complete!</h3><p>You got <b>${st.right} of ${L.quiz.length}</b> right.</p>
      ${tool}${game}${id[0] === 's' ? B('go', '🏛️ Go to the Stock Market Challenge', 'warm-button block', 'data-p="market"') : ''}${B('go', '← Back to lessons', 'primary-button block', `data-p="${{ c: 'career', m: 'money', s: 'stocks' }[id[0]]}"`)}${B('redo', 'Redo this lesson', 'ghost-button block', `data-l="${id}"`)}</div>`;
  }
  function lessonList(ctx, kind) {
    const d = ctx.get(), list = LESSONS[kind], done = list.filter((l) => d.done?.[l.id]).length;
    const intro = { career: 'What could you be? Learn the paths, the skills and how to plan — starting now.', money: 'Learn how money works — earning, budgeting, saving, banks, borrowing, scams and investing.', market: 'How the stock market really works — then practice with $10,000 of play money in REAL stocks.' }[kind];
    return `<p class="note">${intro}</p>
      <div class="panel stack"><div class="row spread"><b>${done} of ${list.length} lessons done</b>${done === list.length ? '<span class="pill st-approved">🏆 Badge earned!</span>' : ''}</div><div class="progress"><i style="width:${(done / list.length) * 100}%"></i></div></div>
      <div class="panel list">${list.map((l, i) => `<button class="row-btn" data-act="lx" data-x="open" data-l="${l.id}"><span class="feed-icon" aria-hidden="true">${l.em}</span>
        <span class="grow"><b>${i + 1}. ${l.title}</b><span class="sub">${d.done?.[l.id] ? `✅ Done · ${d.done[l.id]}/${l.quiz.length}` : `${l.cards.length} quick cards + 3 questions`}</span></span><span class="chev" aria-hidden="true">›</span></button>`).join('')}</div>
      ${kind === 'market' ? B('go', '🏛️ Open the Stock Market Challenge', 'warm-button block big', 'data-p="market"') : kind === 'money' ? `<h3 class="sub-h">🛠️ Money tools</h3><div class="game-tiles">${[['tool-loan', '🏠', 'Loan Lab'], ['tool-budget', '🫙', 'Budget Builder'], ['tool-goal', '🎯', 'Savings Goal'], ['tool-grow', '🌱', 'Money Grower'], ['tool-credit', '💳', 'Credit Card Cost'], ['needs', '🛒', 'Needs vs. Wants']].map(([p, e, n]) => `<button class="game-tile c-quiz" data-act="lx" data-x="go" data-p="${p}"><span class="gt-em">${e}</span><span class="gt-name">${n}</span></button>`).join('')}</div>` : `${B('go', '🧭 Take the Career Interest Inventory', 'warm-button block', 'data-p="inventory"')}${B('go', '📝 My Career Plan', 'ghost-button block', 'data-p="plan"')}`}`;
  }

  // ================================================================ MONEY TOOLS
  function toolBudget(ctx) {
    const d = ctx.get(), b = d.budget || { income: 40, spend: 50, save: 40, give: 10 };
    const tot = b.spend + b.save + b.give;
    const row = (k, em, label) => `<div class="tool-field"><span>${em} ${label}: <b>${b[k]}%</b> = <b>${money((b.income * b[k]) / 100)}</b></span><input type="range" min="0" max="100" step="5" value="${b[k]}" data-lin="${k}" aria-label="${label} percent"></div>`;
    return `<div class="panel stack"><p class="small muted">How much money do you get in a month (allowance, chores, birthday money…)?</p>
      <div class="tool-field"><span>💵 Money in: <b>${money(b.income)}</b> per month</span><input type="range" min="5" max="300" step="5" value="${b.income}" data-lin="income" aria-label="Monthly money"></div>
      ${row('spend', '🛍️', 'Spend')}${row('save', '🐷', 'Save')}${row('give', '💝', 'Give')}
      <div class="jar-row">${[['spend', '🛍️'], ['save', '🐷'], ['give', '💝']].map(([k, e]) => `<div class="jar"><div class="jar-fill" style="height:${Math.min(100, b[k])}%"></div><span>${e}</span></div>`).join('')}</div>
      <p class="center ${tot === 100 ? 'ok-text' : 'warn-text'}"><b>${tot === 100 ? '✅ Every dollar has a job!' : tot > 100 ? `⚠️ That’s ${tot}% — you’re planning more money than you have!` : `🤔 ${100 - tot}% has no job yet.`}</b></p>
      ${tot === 100 && b.save > 0 ? `<p class="center small">Saving ${money((b.income * b.save) / 100)} a month = <b>${money((b.income * b.save) / 100 * 12)}</b> in a year! 🎉</p>` : ''}</div>`;
  }
  function toolGoal(ctx) {
    const d = ctx.get(), g = d.goal || { item: 'New headphones', cost: 80, have: 10, per: 10 };
    const need = Math.max(0, g.cost - g.have), weeks = g.per > 0 ? Math.ceil(need / g.per) : Infinity;
    return `<div class="panel stack"><label class="fld"><span>What are you saving for?</span><input class="field" data-lin="item" maxlength="40" value="${ctx.esc(g.item)}"></label>
      <div class="tool-field"><span>🏷️ It costs: <b>${money(g.cost)}</b></span><input type="range" min="5" max="1000" step="5" value="${g.cost}" data-lin="cost" aria-label="Cost"></div>
      <div class="tool-field"><span>🐷 I already have: <b>${money(g.have)}</b></span><input type="range" min="0" max="1000" step="5" value="${g.have}" data-lin="have" aria-label="Already saved"></div>
      <div class="tool-field"><span>📅 I can save each week: <b>${money(g.per)}</b></span><input type="range" min="0" max="100" step="1" value="${g.per}" data-lin="per" aria-label="Weekly saving"></div>
      <div class="progress big"><i style="width:${Math.min(100, (g.have / g.cost) * 100)}%"></i></div>
      <p class="center big-win">${need === 0 ? 'You can buy it now! 🎉' : weeks === Infinity ? 'Save a little each week to get there!' : `${weeks} week${weeks === 1 ? '' : 's'}`}</p>
      ${need && weeks !== Infinity ? `<p class="center small">to reach <b>${ctx.esc(g.item)}</b> — about ${Math.ceil(weeks / 4.33)} month${Math.ceil(weeks / 4.33) === 1 ? '' : 's'}. Save ${money(g.per + 5)} a week and it’s only <b>${Math.ceil(need / (g.per + 5))} weeks</b>!</p>` : ''}</div>`;
  }
  function growData(g) { // monthly deposits, monthly compounding
    const r = g.rate / 100 / 12; let bal = 0, put = 0; const pts = [];
    for (let m = 1; m <= g.years * 12; m++) { bal = bal * (1 + r) + g.monthly; put += g.monthly; if (m % 12 === 0) pts.push([bal, put]); }
    return { bal, put, pts };
  }
  function toolGrow(ctx) {
    const d = ctx.get(), g = d.grow || { monthly: 20, years: 30, rate: 7 };
    const { bal, put, pts } = growData(g), mx = Math.max(...pts.map((p) => p[0]), 1);
    return `<div class="panel stack"><p class="small muted">See how saving a little every month grows with compound interest.</p>
      <div class="tool-field"><span>🐷 Save each month: <b>${money(g.monthly)}</b></span><input type="range" min="5" max="200" step="5" value="${g.monthly}" data-lin="monthly" aria-label="Monthly saving"></div>
      <div class="tool-field"><span>⏳ For: <b>${g.years} years</b></span><input type="range" min="1" max="50" step="1" value="${g.years}" data-lin="years" aria-label="Years"></div>
      <div class="tool-field"><span>📈 Growth rate: <b>${g.rate}% a year</b> <small>(savings accounts pay less; long-term investing has historically averaged more — but it goes up AND down)</small></span><input type="range" min="0" max="10" step="0.5" value="${g.rate}" data-lin="rate" aria-label="Growth rate"></div>
      <div class="grow-chart" role="img" aria-label="Chart of savings growing">${pts.map(([b, p]) => `<div class="gcol"><i class="g-int" style="height:${((b - p) / mx) * 100}%"></i><i class="g-put" style="height:${(p / mx) * 100}%"></i></div>`).join('')}</div>
      <p class="small center"><span class="key-dot put"></span> money you put in · <span class="key-dot int"></span> growth from interest</p>
      <div class="row spread grow-sum"><div><small>You put in</small><b>${money(Math.round(put))}</b></div><div><small>Interest earned</small><b>${money(Math.round(bal - put))}</b></div><div><small>Total</small><b>${money(Math.round(bal))}</b></div></div>
      ${g.rate > 0 ? `<p class="small center">Rule of 72: money at ${g.rate}% doubles about every <b>${Math.round((72 / g.rate) * 10) / 10} years</b>.</p>` : ''}
      <p class="small muted center">This is a math example, not a promise — real returns change every year.</p></div>`;
  }
  function creditData(c) {
    const r = c.apr / 100 / 12; let bal = c.cost, months = 0, interest = 0;
    if (c.pay <= bal * r) return null;
    while (bal > 0.005 && months < 600) { const i = bal * r; interest += i; bal = bal + i - c.pay; months++; }
    return { months, interest };
  }
  function toolCredit(ctx) {
    const d = ctx.get(), c = d.credit || { cost: 500, apr: 24, pay: 25 };
    const res = creditData(c);
    return `<div class="panel stack"><p class="small muted">What if you bought something with a credit card and paid a little each month?</p>
      <div class="tool-field"><span>🛍️ You buy: <b>${money(c.cost)}</b></span><input type="range" min="50" max="3000" step="50" value="${c.cost}" data-lin="cost" aria-label="Price"></div>
      <div class="tool-field"><span>📈 APR: <b>${c.apr}%</b> <small>(many credit cards charge 20% or more)</small></span><input type="range" min="0" max="36" step="1" value="${c.apr}" data-lin="apr" aria-label="APR"></div>
      <div class="tool-field"><span>💳 You pay each month: <b>${money(c.pay)}</b></span><input type="range" min="10" max="500" step="5" value="${c.pay}" data-lin="pay" aria-label="Monthly payment"></div>
      ${res ? `<div class="row spread grow-sum"><div><small>Time to pay off</small><b>${res.months >= 12 ? `${Math.floor(res.months / 12)}y ${res.months % 12}m` : `${res.months} mo`}</b></div><div><small>Interest paid</small><b class="warn-text">${money(Math.round(res.interest))}</b></div><div><small>Real total cost</small><b>${money(Math.round(c.cost + res.interest))}</b></div></div>
        <p class="center small">${res.interest > c.cost * 0.1 ? `😬 That ${money(c.cost)} thing really cost <b>${money(Math.round(c.cost + res.interest))}</b>.` : '👍 Paying it off fast keeps interest low!'} Paying the full bill every month means <b>no interest at all</b>.</p>`
        : `<p class="center warn-text"><b>⚠️ That payment doesn’t even cover the interest — the debt would never go away!</b></p>`}</div>`;
  }

  // ---- Loan Lab: cars, homes, student loans
  const LOAN_PRESETS = {
    car: { label: '🚗 Car', price: 28000, down: 3000, years: 5, rate: 7, maxPrice: 80000, maxYears: 8, note: 'Car loans are often 3–6 years.' },
    home: { label: '🏠 Home', price: 300000, down: 60000, years: 30, rate: 6.5, maxPrice: 900000, maxYears: 30, note: 'Mortgages are usually 15 or 30 years. 20% down is a common goal.' },
    school: { label: '🎓 Student loan', price: 30000, down: 0, years: 10, rate: 6, maxPrice: 150000, maxYears: 25, note: 'Many student loans are paid back over about 10 years after you finish school.' },
  };
  const payment = (P, ratePct, years) => { const n = years * 12, r = ratePct / 100 / 12; if (P <= 0) return 0; return r ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n; };
  function toolLoan(ctx) {
    const d = ctx.get(), kind = d.loanKind || 'car', L = { ...LOAN_PRESETS[kind], ...(d.loan?.[kind] || {}) };
    const P = Math.max(0, L.price - L.down), M = payment(P, L.rate, L.years), total = M * L.years * 12, interest = total - P;
    const firstInt = P * (L.rate / 100 / 12), firstPrin = M - firstInt;
    const shorter = Math.max(1, kind === 'home' ? (L.years > 15 ? 15 : L.years) : Math.max(1, L.years - 2));
    const M2 = payment(P, L.rate, shorter), int2 = M2 * shorter * 12 - P;
    const sl = (k, label, min, max, step, val, fmt) => `<div class="tool-field"><span>${label}: <b>${fmt(val)}</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-lin="${k}" aria-label="${label}"></div>`;
    return `<div class="chips seg loan-kind" role="group">${Object.entries(LOAN_PRESETS).map(([k, v]) => `<button class="chip" data-act="lx" data-x="loan-kind" data-k="${k}" aria-pressed="${kind === k}">${v.label}</button>`).join('')}</div>
      <div class="panel stack"><p class="small muted">${L.note} Rates here are examples — real rates change, so check with a bank.</p>
        ${sl('price', kind === 'school' ? '🎓 Amount you borrow for school' : kind === 'home' ? '🏠 Home price' : '🚗 Car price', 1000, L.maxPrice, kind === 'home' ? 5000 : 500, L.price, money)}
        ${kind === 'school' ? '' : sl('down', '💵 Down payment', 0, L.price, kind === 'home' ? 5000 : 500, Math.min(L.down, L.price), (v) => `${money(v)} (${pct((v / L.price) * 100)})`)}
        ${sl('rate', '📈 Interest rate (APR)', 0, 15, 0.25, L.rate, (v) => `${v}%`)}
        ${sl('years', '⏳ Loan length', 1, L.maxYears, 1, L.years, (v) => `${v} year${v === 1 ? '' : 's'}`)}
        <div class="row spread grow-sum"><div><small>Monthly payment</small><b>${money(Math.round(M))}</b></div><div><small>Finance charge (interest)</small><b class="warn-text">${money(Math.round(interest))}</b></div><div><small>Total you pay</small><b>${money(Math.round(total + (kind === 'school' ? 0 : L.down)))}</b></div></div>
        <div class="split-bar" aria-label="Borrowed vs. interest"><i class="put" style="width:${(P / Math.max(total, 1)) * 100}%"></i><i class="int" style="width:${(interest / Math.max(total, 1)) * 100}%"></i></div>
        <p class="small center"><span class="key-dot put"></span> money borrowed ${money(Math.round(P))} · <span class="key-dot int"></span> interest ${money(Math.round(interest))}</p>
        <p class="small">🔍 <b>Your first payment:</b> ${money(Math.round(firstInt))} goes to interest and only ${money(Math.round(firstPrin))} pays down the loan.</p>
        ${shorter < L.years ? `<p class="small">⚡ <b>Try ${shorter} years instead:</b> ${money(Math.round(M2))}/month (${money(Math.round(M2 - M))} more), but you’d save <b>${money(Math.round(interest - int2))}</b> in interest!</p>` : ''}
        ${kind !== 'school' && L.down < L.price * 0.2 ? `<p class="small">💡 Saving up a bigger down payment means you borrow less — and pay less interest.</p>` : ''}
      </div>`;
  }
  const NEEDS = [['🍎', 'Groceries', 'need'], ['🏠', 'Rent / a place to live', 'need'], ['🎮', 'New video game', 'want'], ['💊', 'Medicine', 'need'], ['👟', '$200 designer sneakers', 'want'],
    ['🧥', 'Winter coat', 'need'], ['🍿', 'Movie tickets', 'want'], ['💡', 'Electric bill', 'need'], ['📱', 'Newest phone upgrade', 'want'], ['🚌', 'Bus fare to work or school', 'need'],
    ['🍬', 'Candy', 'want'], ['💧', 'Water bill', 'need'], ['🎧', 'Fancy headphones', 'want'], ['🪥', 'Toothpaste', 'need'], ['🎢', 'Theme park trip', 'want'], ['🛏️', 'A bed', 'need']];
  function needsGame(ctx) {
    const d = ctx.get(), g = d.needs?.order ? d.needs : { order: [...NEEDS.keys()].sort(() => Math.random() - 0.5).slice(0, 10), i: 0, right: 0, last: null };
    if (!d.needs?.order) { d.needs = g; ctx.save(d); }
    if (g.i >= g.order.length) return `<div class="panel stack center"><p class="big-win">${g.right} / ${g.order.length}</p><p>${g.right >= 9 ? 'Money master! 💰' : 'Nice! Remember: needs first, then wants.'}</p>${B('needs-again', 'Play again', 'primary-button block')}</div>`;
    const [em, name] = NEEDS[g.order[g.i]];
    return `<div class="panel stack center"><div class="row spread"><span class="pill">${g.i + 1} of ${g.order.length}</span><span class="pill st-approved">${g.right} right</span></div>
      <p class="emoji-clue">${em}</p><h3>${name}</h3>
      <div class="row">${B('nw', '✅ Need', 'primary-button grow big', 'data-v="need"')}${B('nw', '✨ Want', 'warm-button grow big', 'data-v="want"')}</div>
      ${g.last ? `<p class="small">${g.last}</p>` : ''}</div>`;
  }


  // ================================================================ STOCK MARKET CHALLENGE (real stocks, live prices, play money)
  const chg = (p, prev) => (p != null && prev ? { d: p - prev, pc: ((p - prev) / prev) * 100 } : { d: 0, pc: 0 });
  const signCls = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '');
  const arrow = (v) => (v > 0 ? '▲' : v < 0 ? '▼' : '•');
  function ticker(m) {
    const items = m.stocks.filter((x) => x.price != null).map((x) => { const c = chg(x.price, x.prev); return `<span class="tk ${signCls(c.d)}"><b>${x.sym}</b> ${money(x.price)} ${arrow(c.d)} ${Math.abs(c.pc).toFixed(2)}%</span>`; }).join('');
    return items ? `<div class="ticker" aria-label="Live stock ticker"><div class="ticker-track">${items}${items}</div></div>` : '';
  }
  function marketView(ctx) {
    const m = ctx.mem.market;
    if (!m) return '<div class="panel empty"><div class="e">⏳</div><p>Loading the market…</p></div>';
    if (!m.connected) return `<div class="panel stack center"><p class="lesson-em">🔌</p><h3>Live prices aren’t connected yet</h3><p class="small">The grown-up who runs Let’s Hang needs to add a free stock-price key (FINNHUB_KEY). Until then, check out the Stock Market lessons!</p>${B('go', '📚 Stock Market lessons', 'primary-button block', 'data-p="stocks"')}</div>`;
    const me = m.me, gain = me.total - me.start, e = ctx.esc;
    const st = m.status.open ? '<span class="pill st-approved">🟢 Market open · prices update every minute</span>' : `<span class="pill st-declined">🔴 Market closed${m.status.holiday ? ` (${e(m.status.holiday)})` : ''} · opens weekdays 8:30 AM CT</span>`;
    const S = Object.fromEntries(m.stocks.map((x) => [x.sym, x]));
    return `${ticker(m)}<div class="row wrap mk-status">${st}</div>
      <div class="panel stack mk-port"><div class="row spread"><div><small class="muted">My portfolio</small><p class="mk-total">${money(me.total)}</p></div>
        <div class="right"><span class="mk-chg ${signCls(gain)}">${arrow(gain)} ${money(Math.abs(gain))} (${Math.abs((gain / me.start) * 100).toFixed(2)}%)</span><br><small class="muted">since you started with ${money(me.start)}</small></div></div>
        <div class="row spread small"><span>💵 Cash: <b>${money(me.cash)}</b></span><span>📈 Invested: <b>${money(me.invested)}</b></span></div>
        ${me.holdings.length ? `<div class="mk-holdings">${me.holdings.map((h) => { const g = h.value - h.cost; return `<button class="row-btn mk-row" data-act="lx" data-x="go" data-p="stock:${h.symbol}"><span class="mk-em">${S[h.symbol]?.em || '📄'}</span><span class="grow"><b>${h.symbol}</b><span class="sub">${h.shares} share${h.shares === 1 ? '' : 's'} · paid ${money(h.cost)}</span></span><span class="right"><b>${money(h.value)}</b><br><small class="${signCls(g)}">${arrow(g)} ${money(Math.abs(g))}</small></span></button>`; }).join('')}</div>`
          : '<p class="small muted">You don’t own any stocks yet. Tap a company below to buy your first shares!</p>'}</div>
      ${m.board.length > 1 ? `<div class="panel stack"><h3>🏆 Friends leaderboard</h3><div class="list">${m.board.map((b) => `<div class="row-btn static lb-row ${b.me ? 'me' : ''}"><span class="lb-rank">${b.rank === 1 ? '🥇' : b.rank === 2 ? '🥈' : b.rank === 3 ? '🥉' : b.rank}</span>${ctx.ava(b.avatar)}<span class="grow"><b>${e(b.name)}${b.me ? ' (you)' : ''}</b></span><span class="right"><b>${money(b.total)}</b><br><small class="${signCls(b.total - 10000)}">${arrow(b.total - 10000)} ${Math.abs(((b.total - 10000) / 10000) * 100).toFixed(1)}%</small></span></div>`).join('')}</div></div>`
        : '<div class="panel"><p class="small">🏆 When your approved friends join the challenge, you’ll see who’s winning here!</p></div>'}
      <h3 class="sub-h">📋 Stocks you can buy</h3>
      <div class="panel list">${m.stocks.map((x) => { const c = chg(x.price, x.prev); return `<button class="row-btn mk-row" data-act="lx" data-x="go" data-p="stock:${x.sym}"><span class="mk-em">${x.em}</span><span class="grow"><b>${x.sym}</b><span class="sub">${e(x.name)}</span></span><span class="right"><b>${x.price != null ? money(x.price) : '—'}</b><br><small class="${signCls(c.d)}">${arrow(c.d)} ${Math.abs(c.pc).toFixed(2)}%</small></span></button>`; }).join('')}</div>
      <p class="note">Prices are real U.S. stock prices (may be slightly delayed). The money is pretend — it’s practice! Trades only work while the real market is open.</p>
      <div class="row">${B('go', '📚 Stock lessons', 'ghost-button grow', 'data-p="stocks"')}${B('mk-reset', '🔄 Start over', 'ghost-button grow')}</div>`;
  }
  function chartSVG(points) {
    if (points.length < 2) return '<p class="small muted center">📈 The chart builds as the app records prices while the market is open. Check back soon!</p>';
    const ys = points.map((p) => p.price), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1, W = 320, H = 120;
    const pts = ys.map((y, i) => `${((i / (ys.length - 1)) * W).toFixed(1)},${(H - ((y - lo) / span) * (H - 10) - 5).toFixed(1)}`).join(' ');
    const up = ys[ys.length - 1] >= ys[0];
    return `<svg class="mk-chart ${up ? 'up' : 'down'}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Price chart"><polyline points="${pts}" fill="none" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>
      <div class="row spread small muted"><span>${new Date(points[0].at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span><span>low ${money(lo)} · high ${money(hi)}</span><span>now</span></div>`;
  }
  function stockView(ctx, sym) {
    const m = ctx.mem.market, x = m?.stocks.find((s) => s.sym === sym), det = ctx.mem.detail?.[sym];
    if (!m || !x) return '<div class="panel empty"><div class="e">⏳</div><p>Loading…</p></div>';
    const c = chg(x.price, x.prev), h = m.me.holdings.find((y) => y.symbol === sym), qty = Math.max(1, Number(ctx.mem.qty?.[sym] || 1));
    const g = h ? h.value - h.cost : 0;
    return `${ticker(m)}<div class="panel stack"><div class="row"><span class="mk-big-em">${x.em}</span><div class="grow"><h3>${ctx.esc(x.name)}</h3><span class="small muted">${x.sym}${x.index ? ' · index fund' : ''}</span></div></div>
        <p class="small">${ctx.esc(x.about)}</p>
        <div class="row spread"><p class="mk-total">${x.price != null ? money(x.price) : '—'}</p><span class="mk-chg ${signCls(c.d)}">${arrow(c.d)} ${money(Math.abs(c.d))} (${Math.abs(c.pc).toFixed(2)}%) today</span></div>
        ${det ? chartSVG(det.history) : '<p class="small muted center">Loading chart…</p>'}
        <div class="quote-grid"><div><small>Previous close</small><b>${x.prev ? money(x.prev) : '—'}</b></div><div><small>Open</small><b>${x.open ? money(x.open) : '—'}</b></div><div><small>Day range</small><b>${x.low ? `${money(x.low)}–${money(x.high)}` : '—'}</b></div></div></div>
      <div class="panel stack"><h3>${h ? `You own ${h.shares} share${h.shares === 1 ? '' : 's'}` : 'Trade'}</h3>
        ${h ? `<p class="small">Worth <b>${money(h.value)}</b> · you paid ${money(h.cost)} · <span class="${signCls(g)}">${g >= 0 ? 'gain' : 'loss'} ${money(Math.abs(g))}</span></p>` : ''}
        <div class="row"><label class="fld grow"><span>Shares</span><input class="field" type="number" inputmode="numeric" min="1" step="1" value="${qty}" data-lin="qty" data-sym="${sym}" aria-label="Number of shares"></label>
          <div class="grow"><small class="muted">Estimated cost</small><p class="mk-est"><b>${x.price != null ? money(x.price * qty) : '—'}</b></p><small class="muted">Cash: ${money(m.me.cash)}</small></div></div>
        <div class="row">${B('trade', `Buy ${qty}`, 'primary-button grow big', `data-side="buy" data-sym="${sym}" ${m.status.open ? '' : 'disabled'}`)}${B('trade', `Sell ${qty}`, 'warm-button grow big', `data-side="sell" data-sym="${sym}" ${m.status.open && h ? '' : 'disabled'}`)}</div>
        ${m.status.open ? '<p class="small muted">This is a <b>market order</b> — it buys or sells right away at the current price.</p>' : '<p class="small warn-text">🔴 The market is closed. Real U.S. markets trade weekdays 8:30 AM–3:00 PM Central.</p>'}
        ${det?.trades?.length ? `<h4 class="sub-h">Your trades</h4><div class="list small">${det.trades.map((t) => `<div class="row spread"><span>${t.side === 'buy' ? '🟢 Bought' : '🔴 Sold'} ${t.shares} @ ${money(t.price)}</span><span class="muted">${new Date(t.at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span></div>`).join('')}</div>` : ''}</div>
      ${B('go', '← Back to the market', 'ghost-button block', 'data-p="market"')}`;
  }

  // ================================================================ CAREER PLAN builder
  function planView(ctx) {
    const d = ctx.get(), p = d.plan || {}, inv = d.inv && d.inv.i >= QUESTIONS.length ? scoreInv(d.inv.ans) : null;
    const sugg = inv ? inv.order.slice(0, 3).flatMap((k) => TYPES[k].careers.slice(0, 3).map(([n]) => n)) : [];
    const f = (k, label, ph, max = 80) => `<label class="fld"><span>${label}</span><input class="field" data-lin="${k}" maxlength="${max}" value="${ctx.esc(p[k] || '')}" placeholder="${ph}"></label>`;
    return `<div class="panel stack"><p class="small muted">Your plan saves on this phone. Update it anytime — plans are supposed to change!</p>
      ${inv ? `<p class="small">Your interest code is <b>${inv.code}</b>. Ideas: ${sugg.map((s) => `<button class="chip" data-act="lx" data-x="pick-career" data-c="${ctx.esc(s)}">${s}</button>`).join(' ')}</p>` : `<p class="small">💡 Take the ${B('go', 'Career Interest Inventory', 'linkish', 'data-p="inventory"')} first for ideas!</p>`}
      ${f('c1', '🌟 Career I’m curious about #1', 'e.g. Veterinarian')}${f('c2', '🌟 Career #2', 'e.g. Game designer')}${f('c3', '🌟 Career #3', 'e.g. Electrician')}
      ${f('learn', '🔎 One thing I want to find out about them', 'e.g. What training do they need?', 120)}
      ${f('try', '🧪 Something I’ll try this year', 'e.g. Join robotics club', 120)}
      ${f('ask', '🗣️ An adult I could ask about their job', 'e.g. Aunt Kim (nurse)', 60)}
      ${f('goal', '🎯 My SMART goal', 'e.g. Read 2 books about animals by March 1', 140)}
      <p class="small ok-text">✓ Saved automatically</p>
      ${B('print', '🖨️ Print / save my plan', 'ghost-button block')}</div>`;
  }

  // ================================================================ HUB
  function hub(ctx) {
    const d = ctx.get(), cDone = LESSONS.career.filter((l) => d.done?.[l.id]).length, mDone = LESSONS.money.filter((l) => d.done?.[l.id]).length, sDone = LESSONS.market.filter((l) => d.done?.[l.id]).length;
    const inv = d.inv && d.inv.i >= QUESTIONS.length ? scoreInv(d.inv.ans) : null;
    return `<div class="panel stack center fm-hero"><p class="lesson-em">🚀</p><h3>What could the future you be?</h3><p class="small">Find out what you’re into, plan your path, learn how money works and try the real stock market with play money.</p></div>
      <div class="dashboard-grid">
        <button class="action-card friends" data-act="lx" data-x="go" data-p="inventory"><span class="action-icon">🧭</span><span class="action-label">Career Quiz<span class="action-arrow">→</span></span><span class="fm-sub">${inv ? `Your code: ${inv.code}` : '36 quick questions'}</span></button>
        <button class="action-card chat" data-act="lx" data-x="go" data-p="career"><span class="action-icon">🛤️</span><span class="action-label">Career Path<span class="action-arrow">→</span></span><span class="fm-sub">${cDone}/${LESSONS.career.length} lessons</span></button>
        <button class="action-card games" data-act="lx" data-x="go" data-p="money"><span class="action-icon">💰</span><span class="action-label">Money Smarts<span class="action-arrow">→</span></span><span class="fm-sub">${mDone}/${LESSONS.money.length} lessons</span></button>
        <button class="action-card friends" data-act="lx" data-x="go" data-p="stocks"><span class="action-icon">📈</span><span class="action-label">Stock Market<span class="action-arrow">→</span></span><span class="fm-sub">${sDone}/${LESSONS.market.length} lessons</span></button>
        <button class="action-card chat" data-act="lx" data-x="go" data-p="market"><span class="action-icon">🏛️</span><span class="action-label">Stock Challenge<span class="action-arrow">→</span></span><span class="fm-sub">$10,000 play money</span></button>
        <button class="action-card plan" data-act="lx" data-x="go" data-p="plan"><span class="action-icon">📝</span><span class="action-label">My Plan<span class="action-arrow">→</span></span><span class="fm-sub">${d.plan?.c1 ? 'Keep it updated' : 'Start your plan'}</span></button>
      </div>
      <div class="panel stack"><h3>🏅 Badges</h3><div class="badges">${[
        [inv, '🧭', 'Explorer'], [cDone === LESSONS.career.length, '🛤️', 'Path Finder'], [mDone >= 3, '🐷', 'Saver'], [mDone === LESSONS.money.length, '💰', 'Money Pro'], [d.plan?.c1 && d.plan?.goal, '🎯', 'Planner'], [sDone === LESSONS.market.length, '🐂', 'Market Pro'],
      ].map(([on, e, n]) => `<span class="badge-chip ${on ? 'on' : ''}">${e} ${n}</span>`).join('')}</div></div>`;
  }

  const TITLES = { stocks: 'Stock Market', market: 'Stock Challenge', 'tool-loan': 'Loan Lab', home: 'Future Me', inventory: 'Career Quiz', career: 'Career Path', money: 'Money Smarts', plan: 'My Career Plan', 'tool-budget': 'Budget Builder', 'tool-goal': 'Savings Goal', 'tool-grow': 'Money Grower', 'tool-credit': 'Credit Card Cost', needs: 'Needs vs. Wants' };
  window.LH_LEARN = {
    title(page) { if (page.startsWith('stock:')) return page.slice(6); return TITLES[page] || findLesson(page)?.title || 'Future Me'; },
    parent(page) { if (page.startsWith('stock:')) return 'market'; if (page.startsWith('tool-') || page === 'needs') return 'money'; const L = findLesson(page); if (L) return { c: 'career', m: 'money', s: 'stocks' }[L.id[0]]; return page === 'home' ? null : 'home'; },
    live(page) { return page === 'market' || page.startsWith('stock:'); },
    async load(page, ctx) {
      if (!this.live(page)) return;
      try {
        const sym = page.startsWith('stock:') ? page.slice(6) : null;
        const [m, det] = await Promise.all([ctx.api('/market'), sym ? ctx.api(`/market/${sym}`) : null]);
        ctx.mem.market = m; if (det) { ctx.mem.detail = ctx.mem.detail || {}; ctx.mem.detail[sym] = det; }
        ctx.paint();
      } catch (e) { ctx.toast(e.message); }
    },
    render(page, ctx) {
      if (page === 'inventory') return inventory(ctx);
      if (page === 'career' || page === 'money') return lessonList(ctx, page);
      if (page === 'stocks') return lessonList(ctx, 'market');
      if (page === 'market') return marketView(ctx);
      if (page.startsWith('stock:')) return stockView(ctx, page.slice(6));
      if (page === 'tool-loan') return toolLoan(ctx);
      if (page === 'plan') return planView(ctx);
      if (page === 'tool-budget') return toolBudget(ctx);
      if (page === 'tool-goal') return toolGoal(ctx);
      if (page === 'tool-grow') return toolGrow(ctx);
      if (page === 'tool-credit') return toolCredit(ctx);
      if (page === 'needs') return needsGame(ctx);
      if (findLesson(page)) return lessonView(ctx, page);
      return hub(ctx);
    },
    // live inputs (sliders, text) — update without a full repaint where possible
    input(el, page, ctx) {
      const d = ctx.get(), k = el.dataset.lin, num = el.type === 'range';
      if (k === 'qty') { ctx.mem.qty = ctx.mem.qty || {}; ctx.mem.qty[el.dataset.sym] = Math.max(1, Math.floor(Number(el.value) || 1)); return ctx.paint(); }
      if (page === 'tool-loan') { const kind = d.loanKind || 'car'; d.loan = d.loan || {}; d.loan[kind] = { ...(d.loan[kind] || {}), [k]: Number(el.value) }; if (k === 'price' && d.loan[kind].down > d.loan[kind].price) d.loan[kind].down = d.loan[kind].price; ctx.save(d); return ctx.paint(); }
      const key = { 'tool-budget': 'budget', 'tool-goal': 'goal', 'tool-grow': 'grow', 'tool-credit': 'credit', plan: 'plan' }[page]; if (!key) return;
      const defaults = { budget: { income: 40, spend: 50, save: 40, give: 10 }, goal: { item: 'New headphones', cost: 80, have: 10, per: 10 }, grow: { monthly: 20, years: 30, rate: 7 }, credit: { cost: 500, apr: 24, pay: 25 }, plan: {} };
      d[key] = { ...defaults[key], ...(d[key] || {}), [k]: num ? Number(el.value) : el.value.slice(0, 140) };
      ctx.save(d);
      if (num) { const y = scrollY; ctx.paint(); scrollTo(0, y); const again = document.querySelector(`[data-lin="${k}"]`); if (again && el === document.activeElement) again.focus(); }
    },
    act(x, el, ctx) {
      const d = ctx.get();
      if (x === 'go') return ctx.go(el.dataset.p);
      if (x === 'open') { const id = el.dataset.l; d.ls = d.ls || {}; if (!d.ls[id] || d.done?.[id]) d.ls[id] = { card: 0 }; ctx.save(d); return ctx.go(id); }
      if (x === 'ans') { d.inv = d.inv || { i: 0, ans: [] }; d.inv.ans[d.inv.i] = Number(el.dataset.v); d.inv.i++; ctx.save(d); if (d.inv.i >= QUESTIONS.length) ctx.confetti(); ctx.paint(); scrollTo(0, 0); return; }
      if (x === 'inv-back') { d.inv.i = Math.max(0, d.inv.i - 1); ctx.save(d); return ctx.paint(); }
      if (x === 'inv-redo') { d.inv = { i: 0, ans: [] }; ctx.save(d); ctx.paint(); scrollTo(0, 0); return; }
      const id = el?.dataset.l, L = id && findLesson(id);
      if (L) {
        d.ls = d.ls || {}; const st = d.ls[id] = d.ls[id] || { card: 0 };
        if (x === 'card-next') st.card++;
        if (x === 'card-back') st.card = Math.max(0, st.card - 1);
        if (x === 'lq' && st.picked == null) { st.picked = el.dataset.o; if (st.picked === L.quiz[st.q || 0][1]) st.right = (st.right || 0) + 1; }
        if (x === 'lq-next') {
          st.q = (st.q || 0) + 1; st.picked = null;
          if (st.q < L.quiz.length) { st.opts = st.opts || {}; const [, r, ...w] = L.quiz[st.q]; st.opts[st.q] = [r, ...w].sort(() => Math.random() - 0.5); }
          else { d.done = d.done || {}; d.done[id] = st.right || 0; ctx.confetti(); }
        }
        if (x === 'card-next' && st.card === L.cards.length) { st.q = 0; st.right = 0; st.picked = null; const [, r, ...w] = L.quiz[0]; st.opts = { 0: [r, ...w].sort(() => Math.random() - 0.5) }; }
        if (x === 'redo') d.ls[id] = { card: 0 };
        ctx.save(d); ctx.paint(); if (x !== 'lq') scrollTo(0, 0); return;
      }
      if (x === 'nw') {
        const g = d.needs, [, name, ans] = NEEDS[g.order[g.i]], ok = el.dataset.v === ans;
        if (ok) g.right++; g.last = ok ? `✅ Right — ${name} is a ${ans}.` : `❌ ${name} is a ${ans}.`; g.i++;
        if (g.i >= g.order.length && g.right >= 9) ctx.confetti();
        ctx.save(d); return ctx.paint();
      }
      if (x === 'loan-kind') { d.loanKind = el.dataset.k; ctx.save(d); return ctx.paint(); }
      if (x === 'trade') {
        const sym = el.dataset.sym, n = Math.max(1, Math.floor(Number(ctx.mem.qty?.[sym] || 1)));
        el.disabled = true;
        ctx.api('/market/trade', { method: 'POST', body: { symbol: sym, side: el.dataset.side, shares: n } })
          .then((r) => { ctx.toast(`${el.dataset.side === 'buy' ? '🟢 Bought' : '🔴 Sold'} ${n} ${sym} at ${money(r.price)} = ${money(r.amount)}`); if (el.dataset.side === 'buy') ctx.confetti(); return this.load(`stock:${sym}`, ctx); })
          .catch((e) => { ctx.toast(e.message); ctx.paint(); });
        return;
      }
      if (x === 'mk-reset') {
        if (!confirm('Start over with $10,000? Your stocks will be cleared. (You can do this once a week.)')) return;
        ctx.api('/market/reset', { method: 'POST' }).then(() => { ctx.toast('🔄 Fresh start: $10,000 cash'); return this.load('market', ctx); }).catch((e) => ctx.toast(e.message));
        return;
      }
      if (x === 'needs-again') { delete d.needs; ctx.save(d); return ctx.paint(); }
      if (x === 'pick-career') { d.plan = d.plan || {}; const slot = ['c1', 'c2', 'c3'].find((k) => !d.plan[k]) || 'c3'; d.plan[slot] = el.dataset.c; ctx.save(d); return ctx.paint(); }
      if (x === 'print') {
        const p = d.plan || {}, inv = d.inv && d.inv.i >= QUESTIONS.length ? scoreInv(d.inv.ans) : null, e = ctx.esc;
        const w = window.open('', '_blank'); if (!w) return ctx.toast('Allow pop-ups to print your plan');
        w.document.write(`<!doctype html><title>My Career Plan</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;line-height:1.5}h1{margin:0 0 4px}dt{font-weight:700;margin-top:12px}dd{margin:2px 0 0}</style>
          <h1>🚀 My Career Plan</h1><p>${new Date().toLocaleDateString()}</p>${inv ? `<p><b>Interest code:</b> ${inv.code} (${inv.order.slice(0, 3).map((k) => TYPES[k].name).join(', ')})</p>` : ''}
          <dl><dt>Careers I'm curious about</dt><dd>${[p.c1, p.c2, p.c3].filter(Boolean).map(e).join(' · ') || '—'}</dd><dt>What I want to find out</dt><dd>${e(p.learn || '—')}</dd><dt>Something I'll try this year</dt><dd>${e(p.try || '—')}</dd>
          <dt>An adult I could ask</dt><dd>${e(p.ask || '—')}</dd><dt>My SMART goal</dt><dd>${e(p.goal || '—')}</dd></dl><script>print()<\/script>`);
        w.document.close(); return;
      }
      ctx.paint();
    },
  };
})();
