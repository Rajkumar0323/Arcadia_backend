/* eslint-disable no-console */
import { PrismaClient, type GameType, type Difficulty, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type SeedGame = {
  title: string;
  description: string;
  type: GameType;
  difficulty: Difficulty;
  points: number;
  timeLimit?: number;
  content: Prisma.InputJsonValue;
};

const clubs: { name: string; slug: string; icon: string; color: string; description: string; games: SeedGame[] }[] = [
  {
    name: "Code Club",
    slug: "code-club",
    icon: "💻",
    color: "#8b5cf6",
    description: "Squash bugs, crack algorithms and climb the coder leaderboard.",
    games: [
      {
        title: "JavaScript Basics Blitz",
        description: "Quick-fire questions on core JavaScript.",
        type: "QUIZ",
        difficulty: "EASY",
        points: 100,
        timeLimit: 90,
        content: {
          questions: [
            { prompt: "Which keyword declares a block-scoped constant?", options: ["var", "let", "const", "static"], answer: 2 },
            { prompt: "What does `typeof null` return?", options: ["'null'", "'object'", "'undefined'", "'number'"], answer: 1, explanation: "A famous legacy quirk of JavaScript." },
            { prompt: "Which method adds an item to the end of an array?", options: ["push()", "shift()", "unshift()", "pop()"], answer: 0 },
            { prompt: "`===` checks…", options: ["Value only", "Type only", "Value and type", "Reference only"], answer: 2 },
            { prompt: "Which of these is NOT a primitive?", options: ["string", "boolean", "object", "symbol"], answer: 2 },
          ],
        },
      },
      {
        title: "Fact or Bug?",
        description: "Swipe right for true, left for false.",
        type: "TRUE_FALSE",
        difficulty: "EASY",
        points: 80,
        timeLimit: 60,
        content: {
          statements: [
            { text: "HTML is a programming language.", answer: false, explanation: "It's a markup language." },
            { text: "Python uses indentation to define code blocks.", answer: true },
            { text: "Git and GitHub are the same thing.", answer: false },
            { text: "An array index in most languages starts at 0.", answer: true },
            { text: "CSS stands for Cascading Style Sheets.", answer: true },
            { text: "JSON can store functions.", answer: false },
          ],
        },
      },
      {
        title: "Syntax Memory",
        description: "Match each language with its file extension.",
        type: "MEMORY_MATCH",
        difficulty: "MEDIUM",
        points: 120,
        content: {
          pairs: [
            { a: "Python", b: ".py" },
            { a: "TypeScript", b: ".ts" },
            { a: "Java", b: ".java" },
            { a: "Rust", b: ".rs" },
            { a: "Go", b: ".go" },
            { a: "Ruby", b: ".rb" },
          ],
        },
      },
      {
        title: "Dev Word Scramble",
        description: "Unscramble the developer terms.",
        type: "WORD_SCRAMBLE",
        difficulty: "MEDIUM",
        points: 120,
        timeLimit: 150,
        content: {
          words: [
            { word: "FUNCTION", hint: "A reusable block of code" },
            { word: "VARIABLE", hint: "Stores a value" },
            { word: "COMPILER", hint: "Turns source code into machine code" },
            { word: "BOOLEAN", hint: "True or false" },
            { word: "RECURSION", hint: "A function that calls itself" },
          ],
        },
      },
      {
        title: "Order of Operations",
        description: "Drag the steps into the right order.",
        type: "SEQUENCE",
        difficulty: "HARD",
        points: 150,
        content: {
          rounds: [
            { prompt: "Git workflow", items: ["git add", "git commit", "git push", "Open pull request"] },
            { prompt: "Software development lifecycle", items: ["Requirements", "Design", "Implementation", "Testing", "Deployment"] },
            { prompt: "HTTP request flow", items: ["DNS lookup", "TCP handshake", "Send request", "Server responds", "Render page"] },
          ],
        },
      },
      {
        title: "Complete the Code",
        description: "Fill in the missing keyword.",
        type: "FILL_BLANK",
        difficulty: "MEDIUM",
        points: 120,
        timeLimit: 120,
        content: {
          sentences: [
            { text: "In Python, you define a function with the ___ keyword.", answers: ["def"] },
            { text: "The HTML tag for the largest heading is ___.", answers: ["h1", "<h1>"] },
            { text: "SQL command to fetch data: ___ * FROM users;", answers: ["SELECT"] },
            { text: "In JavaScript, `console.___('hi')` prints to the console.", answers: ["log"] },
          ],
        },
      },
    ],
  },
  {
    name: "Math Club",
    slug: "math-club",
    icon: "➗",
    color: "#06b6d4",
    description: "Numbers, patterns and puzzles for problem solvers.",
    games: [
      {
        title: "Mental Math Sprint",
        description: "Solve as fast as you can.",
        type: "QUIZ",
        difficulty: "EASY",
        points: 100,
        timeLimit: 60,
        content: {
          questions: [
            { prompt: "12 × 12 = ?", options: ["124", "144", "132", "154"], answer: 1 },
            { prompt: "√81 = ?", options: ["8", "9", "7", "11"], answer: 1 },
            { prompt: "15% of 200 = ?", options: ["15", "20", "30", "45"], answer: 2 },
            { prompt: "2⁵ = ?", options: ["10", "25", "32", "64"], answer: 2 },
            { prompt: "What is 7 × 8?", options: ["54", "56", "58", "48"], answer: 1 },
          ],
        },
      },
      {
        title: "Number Truths",
        description: "Is the statement true or false?",
        type: "TRUE_FALSE",
        difficulty: "MEDIUM",
        points: 90,
        timeLimit: 60,
        content: {
          statements: [
            { text: "Every prime number is odd.", answer: false, explanation: "2 is prime and even." },
            { text: "π is an irrational number.", answer: true },
            { text: "The sum of angles in a triangle is 180°.", answer: true },
            { text: "0 is a positive number.", answer: false },
            { text: "A square is a rectangle.", answer: true },
          ],
        },
      },
      {
        title: "Formula Flip",
        description: "Match each shape with its area formula.",
        type: "MEMORY_MATCH",
        difficulty: "MEDIUM",
        points: 120,
        content: {
          pairs: [
            { a: "Circle", b: "πr²" },
            { a: "Square", b: "a²" },
            { a: "Triangle", b: "½bh" },
            { a: "Rectangle", b: "l × w" },
            { a: "Trapezium", b: "½(a+b)h" },
          ],
        },
      },
      {
        title: "Math Word Jumble",
        description: "Unscramble the math vocabulary.",
        type: "WORD_SCRAMBLE",
        difficulty: "EASY",
        points: 100,
        content: {
          words: [
            { word: "ANGLE", hint: "Formed by two rays" },
            { word: "FRACTION", hint: "Part of a whole" },
            { word: "INTEGER", hint: "A whole number" },
            { word: "RADIUS", hint: "Half the diameter" },
          ],
        },
      },
      {
        title: "Smallest to Largest",
        description: "Order the numbers.",
        type: "SEQUENCE",
        difficulty: "MEDIUM",
        points: 120,
        content: {
          rounds: [
            { prompt: "Order from smallest to largest", items: ["0.05", "0.5", "5/8", "0.75", "1.2"] },
            { prompt: "Order from smallest to largest", items: ["-10", "-3", "0", "√2", "π"] },
          ],
        },
      },
      {
        title: "Fill the Formula",
        description: "Complete the math facts.",
        type: "FILL_BLANK",
        difficulty: "HARD",
        points: 150,
        timeLimit: 120,
        content: {
          sentences: [
            { text: "a² + b² = ___ (Pythagoras)", answers: ["c²", "c^2", "c2"] },
            { text: "The value of π to two decimals is ___.", answers: ["3.14"] },
            { text: "A polygon with 6 sides is a ___.", answers: ["hexagon"] },
            { text: "The derivative of x² is ___.", answers: ["2x"] },
          ],
        },
      },
    ],
  },
  {
    name: "Science Club",
    slug: "science-club",
    icon: "🔬",
    color: "#22c55e",
    description: "Experiments of the mind — physics, chemistry and biology.",
    games: [
      {
        title: "Space Quiz",
        description: "How well do you know our universe?",
        type: "QUIZ",
        difficulty: "MEDIUM",
        points: 110,
        timeLimit: 90,
        content: {
          questions: [
            { prompt: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], answer: 1 },
            { prompt: "What is the closest star to Earth?", options: ["Sirius", "Proxima Centauri", "The Sun", "Polaris"], answer: 2 },
            { prompt: "Largest planet in our solar system?", options: ["Saturn", "Neptune", "Jupiter", "Earth"], answer: 2 },
            { prompt: "Light from the Sun reaches Earth in about…", options: ["8 seconds", "8 minutes", "8 hours", "8 days"], answer: 1 },
          ],
        },
      },
      {
        title: "Myth Busters",
        description: "Science fact or popular myth?",
        type: "TRUE_FALSE",
        difficulty: "EASY",
        points: 80,
        timeLimit: 60,
        content: {
          statements: [
            { text: "Lightning never strikes the same place twice.", answer: false },
            { text: "Water expands when it freezes.", answer: true },
            { text: "Humans only use 10% of their brains.", answer: false },
            { text: "Sound travels faster in water than in air.", answer: true },
            { text: "Bats are blind.", answer: false },
          ],
        },
      },
      {
        title: "Element Match",
        description: "Pair each element with its symbol.",
        type: "MEMORY_MATCH",
        difficulty: "EASY",
        points: 100,
        content: {
          pairs: [
            { a: "Gold", b: "Au" },
            { a: "Iron", b: "Fe" },
            { a: "Sodium", b: "Na" },
            { a: "Oxygen", b: "O" },
            { a: "Silver", b: "Ag" },
            { a: "Potassium", b: "K" },
          ],
        },
      },
      {
        title: "Lab Word Scramble",
        description: "Unscramble the science words.",
        type: "WORD_SCRAMBLE",
        difficulty: "MEDIUM",
        points: 110,
        content: {
          words: [
            { word: "ATOM", hint: "Basic unit of matter" },
            { word: "GRAVITY", hint: "Keeps us on the ground" },
            { word: "PHOTON", hint: "A particle of light" },
            { word: "MOLECULE", hint: "Two or more atoms bonded" },
          ],
        },
      },
      {
        title: "Life Cycles",
        description: "Put the stages in order.",
        type: "SEQUENCE",
        difficulty: "EASY",
        points: 100,
        content: {
          rounds: [
            { prompt: "Butterfly life cycle", items: ["Egg", "Caterpillar", "Pupa", "Butterfly"] },
            { prompt: "Water cycle", items: ["Evaporation", "Condensation", "Precipitation", "Collection"] },
          ],
        },
      },
      {
        title: "Science Blanks",
        description: "Complete the scientific facts.",
        type: "FILL_BLANK",
        difficulty: "MEDIUM",
        points: 120,
        content: {
          sentences: [
            { text: "Plants make food through ___.", answers: ["photosynthesis"] },
            { text: "The chemical formula of water is ___.", answers: ["H2O", "H₂O"] },
            { text: "The powerhouse of the cell is the ___.", answers: ["mitochondria", "mitochondrion"] },
            { text: "Force = mass × ___.", answers: ["acceleration"] },
          ],
        },
      },
    ],
  },
  {
    name: "Language Club",
    slug: "language-club",
    icon: "📚",
    color: "#f97316",
    description: "Words, grammar and wordplay for wordsmiths.",
    games: [
      {
        title: "Grammar Check",
        description: "Pick the grammatically correct option.",
        type: "QUIZ",
        difficulty: "EASY",
        points: 100,
        timeLimit: 90,
        content: {
          questions: [
            { prompt: "Choose the correct sentence:", options: ["Their going home.", "They're going home.", "There going home."], answer: 1 },
            { prompt: "Plural of 'child'?", options: ["Childs", "Children", "Childes"], answer: 1 },
            { prompt: "Antonym of 'ancient'?", options: ["Old", "Modern", "Historic", "Antique"], answer: 1 },
            { prompt: "Which is an adverb?", options: ["Quick", "Quickly", "Quicker"], answer: 1 },
          ],
        },
      },
      {
        title: "Word Facts",
        description: "True or false about the English language.",
        type: "TRUE_FALSE",
        difficulty: "MEDIUM",
        points: 90,
        content: {
          statements: [
            { text: "'Rhythm' contains no vowels a, e, i, o or u.", answer: true },
            { text: "A noun describes an action.", answer: false },
            { text: "'Racecar' is a palindrome.", answer: true },
            { text: "'Its' and 'it's' mean the same thing.", answer: false },
          ],
        },
      },
      {
        title: "Synonym Pairs",
        description: "Match words with the same meaning.",
        type: "MEMORY_MATCH",
        difficulty: "MEDIUM",
        points: 120,
        content: {
          pairs: [
            { a: "Happy", b: "Joyful" },
            { a: "Big", b: "Enormous" },
            { a: "Fast", b: "Rapid" },
            { a: "Smart", b: "Clever" },
            { a: "Brave", b: "Fearless" },
          ],
        },
      },
      {
        title: "Vocab Scramble",
        description: "Unscramble the vocabulary words.",
        type: "WORD_SCRAMBLE",
        difficulty: "HARD",
        points: 140,
        timeLimit: 180,
        content: {
          words: [
            { word: "ELOQUENT", hint: "Fluent and persuasive in speech" },
            { word: "RESILIENT", hint: "Recovers quickly from difficulty" },
            { word: "CANDID", hint: "Truthful and straightforward" },
            { word: "METAPHOR", hint: "A figure of speech" },
          ],
        },
      },
      {
        title: "Story Builder",
        description: "Arrange the sentences into a story.",
        type: "SEQUENCE",
        difficulty: "MEDIUM",
        points: 120,
        content: {
          rounds: [
            {
              prompt: "Put the story in order",
              items: ["Riya woke up late.", "She rushed to catch the bus.", "The bus had already left.", "She decided to walk and enjoyed the sunrise."],
            },
            { prompt: "Parts of an essay", items: ["Introduction", "Body paragraphs", "Conclusion"] },
          ],
        },
      },
      {
        title: "Idiom Fill",
        description: "Complete the common idioms.",
        type: "FILL_BLANK",
        difficulty: "MEDIUM",
        points: 120,
        content: {
          sentences: [
            { text: "Break a ___! (good luck)", answers: ["leg"] },
            { text: "It's raining cats and ___.", answers: ["dogs"] },
            { text: "Once in a blue ___.", answers: ["moon"] },
            { text: "The ball is in your ___.", answers: ["court"] },
          ],
        },
      },
    ],
  },
];

const courses = [
  { title: "Full-Stack Web Development", description: "HTML to deployment — build real projects with React, Node and PostgreSQL.", price: 4999, category: "Programming" },
  { title: "Python for Beginners", description: "Learn programming fundamentals with Python.", price: 1999, category: "Programming" },
  { title: "Competitive Math Olympiad Prep", description: "Problem-solving strategies for math olympiads.", price: 2999, category: "Math" },
  { title: "Spoken English Mastery", description: "Confident communication in 30 days.", price: 1499, category: "Language" },
  { title: "Physics Made Visual", description: "Concepts explained with animations and experiments.", price: 2499, category: "Science" },
];

async function main() {
  const now = new Date();
  for (const c of clubs) {
    const club = await prisma.club.upsert({
      where: { slug: c.slug },
      update: {},
      create: { name: c.name, slug: c.slug, icon: c.icon, color: c.color, description: c.description },
    });

    const existingGames = await prisma.game.count({ where: { clubId: club.id } });
    if (existingGames === 0) {
      const created = [];
      for (const [i, g] of c.games.entries()) {
        created.push(await prisma.game.create({ data: { ...g, clubId: club.id, sortOrder: i } }));
      }
      await prisma.quest.create({
        data: {
          clubId: club.id,
          title: `${c.name} Starter Quest`,
          description: "Pass the first three games to earn a bonus.",
          bonusPoints: 250,
          startsAt: new Date(now.getTime() - 86400_000),
          games: { create: created.slice(0, 3).map((g, sortOrder) => ({ gameId: g.id, sortOrder })) },
        },
      });
      await prisma.quest.create({
        data: {
          clubId: club.id,
          title: "Master Challenge",
          description: "Pass every game in the club.",
          bonusPoints: 600,
          startsAt: new Date(now.getTime() - 86400_000),
          games: { create: created.map((g, sortOrder) => ({ gameId: g.id, sortOrder })) },
        },
      });
    }

    const seasons = await prisma.season.count({ where: { clubId: club.id } });
    if (seasons === 0) {
      await prisma.season.create({
        data: {
          clubId: club.id,
          name: `Season ${now.toLocaleString("en", { month: "long" })}`,
          startsAt: new Date(now.getTime() - 2 * 86400_000),
          endsAt: new Date(now.getTime() + 28 * 86400_000),
          tiers: {
            create: [
              { rankFrom: 1, rankTo: 1, type: "PASS", minDiscount: 50, maxDiscount: 50, validDays: 60, label: "Champion Pass" },
              { rankFrom: 2, rankTo: 3, type: "SCRATCH_CARD", minDiscount: 25, maxDiscount: 40, validDays: 45 },
              { rankFrom: 4, rankTo: 10, type: "SCRATCH_CARD", minDiscount: 10, maxDiscount: 25, validDays: 30 },
            ],
          },
        },
      });
    }
  }

  if ((await prisma.course.count()) === 0) await prisma.course.createMany({ data: courses });

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
