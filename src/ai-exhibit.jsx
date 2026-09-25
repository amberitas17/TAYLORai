import React, { useEffect, useRef, useState } from 'react';
import { FiEye, FiArrowLeft, FiMapPin, FiChevronRight, FiNavigation } from 'react-icons/fi';
import './ai-exhibit.css';
import AINavigation from './components/AINavigation';
import LeafletMap from './components/LeafletMap';
import aiNavigationService from './services/aiNavigationService';
import exhibitDetectionService from './services/exhibitDetectionService.js';

const width = window.innerWidth;
// Complete exhibit database with all Science Centre exhibits
const exhibitPath = [
  {
    id: 10,
    name: 'Kinetic Garden',
    key: 'kinetic_garden',
    description: 'Our Science Centre welcome begins at the Kinetic Garden, where you can discover the inter-relationship among forms of energy and more through interactive exhibits such as the Magic Swing, a Sundial and a Lithophone. The Kinetic Garden is a unique outdoor exhibition which demonstrates certain scientific principles and phenomena that would be difficult to create in an indoor setting.',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/kinetic-garden/teasers/kineticgarden-teaser.jpg',
    hall: 'kinetic_garden',
    mapPosition: { x: 45, y: 65 },
    displays: [
      {
        image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/kinetic-garden/highlights/kineticgarden-highlight-01.jpg',
        name: 'Echo',
        description: 'Speak into the Echo Tube and listen to the echoes!'
      },
      {
        image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/kinetic-garden/highlights/kineticgarden-highlight-02.jpg',
        name: 'Giant Chair',
        description: 'Places everyone! Position your camera at the photo spot onsite (on the yellow sticker) and be tickled by the interesting illusion of how large or small your photo subjects look seated on the two chairs! It perfectly demonstrates how our visual system relies on shortcuts and sometimes glosses over details in favour of the big picture!'
      },
    ]
  },
  {
    id: 20,
    name: "The Mind's Eye",
    key: 'minds_eye',
    description: 'Do you believe what you see? Think again! Our exhibition is curated to inspire you with a fresh perspective.',
    image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/the-mind's-eye/teasers/themindseye-teaser.jpg",
    hall: 'entrance_hall',
    mapPosition: { x: 20, y: 35 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/the-mind's-eye/highlights/themindseye-highlight-01.jpg",
        name: 'The Unexpected Dinner',
        description: 'Crawl in from the back and stick your head through the hole above.Through the cleverly placed mirrors that reflect the background, an illusion of empty space is created that hides where the rest of your body should be! It’s headless fun!'
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/the-mind's-eye/highlights/highlight-giant-chair-(002).jpg",
        name: 'Giant Chair',
        description: 'Position your camera lens behind the ‘peephole’ and observe how two wrongs become right – as the separated pieces of a chair magically align. With photo subjects, the effect of this illusion gets only better! It’s a fun way to learn how our visual system relies on shortcuts and can gloss over details in favour of the big picture!'
      },
    ]
  },
  {
    id: 12,
    name: 'Laser Maze Challenge',
    key: 'laser_maze',
    description: "Harness your inner Ninja and test your reflexes in a field of laser beams in Singapore.",
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/laser-maze-challenge/teasers/lasermaze-teaser.jpg',
    hall: 'hall_a',
    mapPosition: { x: 85, y: 75 },
    displays: [
      {
        image: "https://i.imgur.com/vJp3eyk.png",
        name: 'Entrapment',
        description: "Step into the future of laser maze challenges with Entrapment, an immersive experience that takes interactive gameplay to thrilling new heights. Unlike any maze before, Entrapment combines strategy, agility, and precision in a high-stakes environment. As you navigate through a maze of lasers, the difficulty increases with every move, testing your reflexes and decision-making skills. Whether you're a seasoned player or new to the world of laser mazes, Entrapment offers a fresh, exciting challenge for everyone. Are you ready to face the ultimate test and escape the maze?",
      },
      {
        image: "https://i.imgur.com/SEw4CW1.png",
        name: 'Beam Buster',
        description: "Get ready to let loose with Beam Buster, a fast-paced, high-energy game mode where players jump, run, and dive through a field of laser beams. The goal? Break as many beams as possible before time runs out! This exhilarating challenge will get your heart racing and is perfect for both kids and the young at heart. With every move, the excitement builds as you race against the clock, making Beam Buster an addictively fun experience that keeps you coming back for more. How many beams can you bust before the time’s up?",
      },
      {
        image: "https://i.imgur.com/2YNn0G1.png",
        name: 'Laser Maze Challenge',
        description: "Are you quick on your feet and up for a challenge? Harness your inner Ninja and test your reflexes as you race against time to maneuver through a dense field of laser beams. Step into a completely dark arena with more than 50 laser beams. Your mission is to navigate the maze and complete it without coming into contact with any laser beam. Jumping, hopping, crawling, moving with your back against the floor… The laser maze challenge puts your agility and reflexes to the test!",
      },
    ]
  },
  {
    id: 14,
    name: "Professor Crackitt's Light Fantastic Mirror Maze",
    key: 'mirror_maze',
    description: "Welcome to Professor Crackitt's laboratory – a life-size labyrinth of mirrors, filled with infinite reflections and endless hallways. Help Professor Crackitt to find his pet parrot – Wattnot – who has gotten lost in the vast laboratory. Will you be able to find your way through the identical corridors that seem to loop back confusingly on themselves? As you stop to re-orientate yourself on your journey, be sure to check out the Professor's numerous whimsical inventions. Just be careful not to run into yourself on your way out!",
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/mirror-maze/teasers/mirrormaze-teaser.jpg',
    hall: 'hall_a',
    mapPosition: { x: 50, y: 85 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/mirror-maze/highlights/mirrormaze-highlight-01.jpg",
        name: 'Dynamic Chromatology Shadow Splitter',
        description: "Move around the room. As you block one or more of the three coloured lights, you will create various coloured shadows that are a reflection of, or a mixture of the remaining light colours. How many different coloured shadows can you create?",
      },
    ]
  },
  {
    id: 19,
    name: 'The Giant Zoetrope',
    key: 'giant_zoetrope',
    description: "Once the zoetrope starts to spin and the strobe lights flash, our brain is 'tricked' into interpreting the 3D individual static images as a single moving image and thus the zoetrope appears to come to life before our own eyes!",
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/zoetrope/banners/zoetrope-banner.jpg',
    hall: 'hall_a',
    mapPosition: { x: 75, y: 30 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/zoetrope/highlights/zoetrope-highlight.jpg",
        name: 'Zoetrope',
        description: "Once the zoetrope starts to spin and the strobe lights flash, our brain is ‘tricked’ into interpreting the 3D individual static images as a single moving image and thus the zoetrope appears to come to life before our own eyes!",
      },
    ]
  },
  {
    id: 23,
    name: 'Waterworks',
    key: 'waterworks',
    description: 'A fun-filled attraction to learn about how important water is in our lives!',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/waterworks/teasers/waterworks-teaser.jpg',
    hall: 'entry_hall_a',
    mapPosition: { x: 80, y: 50 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/waterworks/highlights/waterworks-highlights-02.jpg",
        name: 'Water Clock Tower',
        description: "Not just a pretty face, this giant mechanical Water Clock Tower comes equipped with an anemometer to measure wind speed, a windsock to indicate wind direction and a rain gauge to measure the amount of Rainfall! Try to spot them all!",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/waterworks/highlights/waterworks-highlights-01.jpg",
        name: 'Water Maze',
        description: "Navigate a maze of water jets and learn about the importance of water. Have fun and try not to get too wet unless that’s part of the plan!",
      },
    ]
  },
  {
    id: 22,
    name: 'Urban Mutations',
    key: 'urban_mutations',
    description: 'Explore the changing face of cities. What is your city like? What kind of cities do we want? Cities are growing at a meteoric rate in our increasingly globalized world. Examine urban changes from a functional, technological, and sociological angle. What is the state of knowledge and representation of cities today? What are some examples of current or planned innovations and initiatives in response to issues facing urban ecosystems? Through this exhibition, visitors are encouraged to reflect on the approach to cities at the beginning of the 21st century.',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/urban-mutation/teasers/zone1_dsc_0454_b_teaser3650d13e7d3b493cb5c930d83c02496b.jpg',
    hall: 'hall_a',
    mapPosition: { x: 60, y: 45 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/urban-mutation/highlights/zone1_0467_a_highlight929d7d3916af43778bb57b22aa9cf33b.jpg",
        name: 'Cities Under Pressure',
        description: "In this zone, the complexity of the “city” system is dissected into basic components to reveal its hidden workings, and the tensions that can arise. Examine and reflect upon your experience and use of the city as a citizen. ",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/urban-mutation/highlights/zone3_dsc_0519_highlight3e49b43a37fe4c5cb2a457760d7f70da.jpg",
        name: 'Urban Futures',
        description: "Explore an array of urban solutions selected for their originality, specificity, or exemplary character. Be amazed by initiatives and innovations undertaken by various cities and their citizens to address the urban challenges that they face.",
      },
    ]
  },
  {
    id: 15,
    name: 'Savage Garden',
    key: 'savage_garden',
    description: 'Journey through a whimsical village inhabited by a group of extraordinary plants – Carnivorous Plants! Meet with the natives and explore their homes to unveil their lives, special abilities, and usual dining habits…!',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/savage-garden/1cp_stage2(1).jpg',
    hall: 'hall_a',
    mapPosition: { x: 70, y: 90 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/savage-garden/1cp_stage(1).jpg",
        name: 'Plant Theatre',
        description: "Watch three short show sequences starring our five larger-than-life carnivorous plant characters! Through a rousing song & dance routine and gossipy conversations, listen as they rave about their favorite foods, share concerns for their future, and explore what makes them truly carnivorous plants.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/savage-garden/2cp_tank(1).jpg",
        name: 'Paludarium Tank',
        description: "Curious about actual carnivorous plants after meeting and learning about our five fictitious counterparts? Check out our impressive tank of live plants! Can you try to spot the different types of carnivorous plants within?",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/savage-garden/3cp_vft(1).jpg",
        name: 'Snap Snap!',
        description: "Photo time! Take the chance to snap a unique photo, within this snap-er, while posing as a snap-ee!",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/savage-garden/3cp_pitcherslide(1).jpg",
        name: 'Pitcher Slide',
        description: "Take a slide down the giant pitcher to explore its slippery insides!",
      },
    ]
  },
  {
    id: 18,
    name: 'Some Call It Science',
    key: 'some_call_it_science',
    description: 'Step into a space where curiosity is your superpower, asking questions is encouraged and experimentation is a must. Some Call It Science is more than just an exhibition—it\'s an invitation to explore, wonder, and play your way to new discoveries. Some Call It Science, we call it FUN.',
    image: 'https://www.science.edu.sg/images/default-source/branding-comms-/scis-web-teaser.jpg',
    hall: 'hall_a',
    mapPosition: { x: 55, y: 25 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/branding-comms-/scis-website-3.png",
        name: 'The "O"',
        description: "Right at the entrance, under the glowing “O” installation, lies the heart of science engagement. This is where the magic of hands-on activities and live demos happens. Get involved, ask away and walk out saying, “Oh... I just learned something amazing!”",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/some-call-it-science/library/scis-web-teaser.jpg",
        name: 'Science Kombat: Sci-KO',
        description: "Gear up for some friendly competition! In this arcade-style game, choose three superpowers from the 9 positive traits highlighted in “Unlock Your Powers” exhibit and battle against a friend or the computer. May the best player win!",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/branding-comms-/scis-website-2.png",
        name: 'Unlock Your Powers: Becoming Extra-Ordinary',
        description: "Dive into the world of nine individuals who reshaped our world with their curiosity, keen observation skills and ability to connect ideas. Through vibrant comic strips, get to know their “superpowers” that led to groundbreaking innovations and discoveries.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/branding-comms-/some-call-it-science--dsc_6636.jpg",
        name: 'Interactive Islands',
        description: "Put the Scientific Method to practice at six different activity stations, designed to spark your curiosity and push your critical thinking skills. Observe, question, experiment and draw conclusions as you engage with hands-on challenges that’ll have you thinking like a scientist!",
      },
    ]
  },
  {
    id: 11,
    name: 'Know Your Poo',
    key: 'know_your_poo',
    description: 'Know Your Poo is a seriously fun exhibition that touches on the topics of human waste, toilets, and sanitation! As you wind your way through the exhibition, you will discover how and why we need to poo. You also learn about the history and evolution of sanitation and toilets. The exhibition also highlights the urgent issue of the global divide. It then shows how engineering solutions might answer some of these challenges. Know Your Poo serves as a reminder that we all need to pay attention to the importance of providing good sanitation and practising good habits in order to safeguard our health and be a better society.',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/know-your-poo/teaser_highlights/know-your-poo_highlight-1.jpg',
    hall: 'hall_b',
    mapPosition: { x: 65, y: 70 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/know-your-poo/teaser_highlights/know-your-poo_highlight-4.jpg",
        name: 'To Flush or Not To Flush?',
        description: "Have you ever flushed your pet fish down the toilet bowl? You may not be the only one! However, there are things you just should not flush down the loo. Challenge yourself to identify things you should or should not flush down the toilet bowl.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/know-your-poo/teaser_highlights/know-your-poo_highlight-1.jpg",
        name: 'How Well Do You Poo?',
        description: "Uncover what makes you poo and what affects your poo? Did you know that a doctor developed a chart to help patients describe their bowel movement known as the Bristol Stool Chart? Come and compare your poo against it.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/know-your-poo/teaser_highlights/know-your-poo_highlight-5.jpg",
        name: 'Cheeky Fart Chamber',
        description: "Encounter a chamber of surprises where secret whispers narrate why we fart and what makes fart smelly.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/know-your-poo/teaser_highlights/know-your-poo_highlight-3.jpg",
        name: 'Singapore Story',
        description: "What was it like to go to the toilet 60 years ago in Singapore? Take a journey back in time to see how Singapore has progressed from open defecation to the night soil truck to modern-day toilets in this section.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/know-your-poo/teaser/know-your-poo_teaser.jpg",
        name: 'Royal Throne',
        description: "This may not be the only Instagram-able spot in our exhibition, but this one is all about you! Let your hair down and have fun with this scene! Come play the part of Queen or King as you pose on the porcelain Royal Throne with your friends or family.",
      },
    ]
  },
  {
    id: 13,
    name: 'Phobia2: The Science of Fear',
    key: 'phobia2',
    description: 'Face your fears in an exciting journey of self-discovery. Understanding and managing fear can be entertaining! What is there to fear? Embark on a journey of self-discovery and find out what phobia really is. Welcome to the award-winning exhibition that explores the topic of fear, from its historical and cultural significance to the psychology and physiology of fear and how it affects our daily lives. Be prepared for something different and perhaps learn to better manage your own fears!',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/phobia/teasers/phobia-teaser.jpg',
    hall: 'hall_b',
    mapPosition: { x: 30, y: 80 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/phobia/highlights/phobia-highlight-01.jpg",
        name: 'Buried Alive',
        description: "Before the age of modern medicine, when the diagnosis of death was less accurate, coffins were often fitted with a bell-rigged device above-ground. Should a person awake from the dead (for those mistakenly buried alive), they would alert mourners of their ghastly plight.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/phobia/highlights/phobia-highlight-02.jpg",
        name: 'Public Speaking',
        description: "Gain confidence through a simulated public speaking scenario in front of an audience! Difficulty concentrating, dry mouths, trembling hands and reduced field of vision are all inclusive!",
      },
    ]
  },
  {
    id: 4,
    name: 'Earth Alive',
    key: 'earth_alive',
    description: "The Earth is constantly changing. Some changes are incremental, some are split-second, but both can result in violent events that devastate human communities. Experience Earth Alive, where you can encounter forces and processes that underlie Earth's changes. Through active, engaging exhibits and compelling visual displays, get a feel for some of Earth's physical functionings! The exhibits are organised into spheres that reflect Earth sciences and systems – Geosphere, Hydrosphere and Atmosphere. Each of these spheres looks at how Earth changes can manifest in the environment, causing phenomena such as earthquakes, tsunamis, mountain-building and rock strata, and volcanic eruptions. A fourth section, the Human Sphere, places people into the picture to highlight how Earth changes impact our lives in critical ways and how we can affect the Earth and respond to such changes.",
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/earth-alive/teaser-image/earth-alive-web-teaser.jpg',
    hall: 'hall_b',
    mapPosition: { x: 75, y: 35 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/earth-alive/highlights/gaia.jpg",
        name: 'GAIA',
        description: "Be mesmerised by the GAIA, a 5-metre inflatable globe installation by artist Luke Jerram, featuring detailed NASA imagery of the Earth surface.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/earth-alive/highlights/giant-slinky.jpg",
        name: 'Giant Slinky',
        description: "Send dramatic P and S waves of an earthquake down a giant slinky!",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/earth-alive/highlights/ar-sandbox.jpg",
        name: 'AR Sandbox',
        description: "Shape a landscape with sand and watch real-time topographic projections to make the connection between elevation and contour lines. You can create with your hands and watch the rain form a watershed.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/earth-alive/highlights/earth-visualisation.jpg",
        name: 'Earth Visualisation',
        description: "View visualisations of various Earth datasets on a high-resolution, multi-screen display. You can cue and combine visualisations via an interactive kiosk and watch them play out across the video wall.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/earth-alive/highlights/disaster-teamwork.jpg",
        name: 'Disaster Teamwork',
        description: "To reduce the impact of natural hazards, people need to work together and coordinate their efforts. Work with others to get the little human blocks to high ground and save them from a flood!",
      },
    ]
  },
  {
    id: 2,
    name: 'Dialogue with Time',
    key: 'dialogue_with_time',
    description: "Dialogue with Time is an interactive exhibition that shows ageing from an original perspective. By 2030, one third of the world's population will be over the age of 65. As this is an important social issue, we aim for individuals to experience and understand more about the ageing process and reconsider their perception of ageing.",
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/dialogue-with-time/teasers/dialoguewithtime-teaser.jpg',
    hall: 'hall_b',
    mapPosition: { x: 35, y: 25 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/dialogue-with-time/heartdrum---science-of-ageing.jpg",
        name: 'Science of Ageing',
        description: "Ageing is an ongoing process that eventually causes an irreversible decline in body functions. Through the interactive exhibitions in this zone, individuals will be able to distinguish between natural causes of ageing and causes from external factors. We highlight common misconceptions associated to ageing such as the skin, bones and dementia.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/dialogue-with-time/carousels/dialoguewithtime-carousel-08.jpg",
        name: 'Guided Experience by our Senior Guides',
        description: "This guided experience is led by passionate retirees aged 60 and above, who will take you through six thoughtfully curated stations. With their lived experiences and wisdom, our senior guides bring each station to life by sharing personal stories, explaining exhibits, and facilitating meaningful discussions that challenge stereotypes and spark inter-generational dialogue.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/dialogue-with-time/dr1-guided-experience.jpg",
        name: 'My Aging Journey',
        description: "Following their stories, you’ll take part in a short activity where you can express what happy ageing means to you. This space invites open sharing and thoughtful reflection, encouraging a deeper understanding of how ageing is shaped by personal experience rather than societal expectations. Discover how we can collectively challenge stereotypes and embrace ageing as a meaningful, individual journey.",
      },
    ]
  },
  {
    id: 6,
    name: 'Energy',
    key: 'energy',
    description: "Energy is all around us. While we might often find it difficult to visualise energy, humankind has learnt how to harness energy for work. Jointly presented by Science Centre Singapore, the Energy Market Authority and SP Group, the Energy Story exhibition captures the story of how humankind has progressed off the back of energy discovery, and must now work towards a cleaner, more sustainable future. The exhibition features six zones of multimedia displays and interactives where visitors can learn about the sources, transformation and uses of energy, from natural cycles to modern applications. There are also exhibits featuring Singapore's own energy sector, raising awareness of our four energy switches and how we are working towards a greener energy mix. The exhibition also addresses our responsibility as energy consumers, presenting a vision of a clean and energy-efficient future.",
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/energy/web-teaser.jpg',
    hall: 'hall_b',
    mapPosition: { x: 40, y: 45 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/energy/energy-carousel-images/energy-exhibition---energy-cycle.jpg",
        name: 'Energy Cycle',
        description: "Learn about energy cycles in nature by watching this animated feature that uses a special projection effect know as pepper's ghost.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/energy/energy-carousel-images/energy-exhibition---conservation-of-linear-momentum.jpg",
        name: 'Galilean Cannon',
        description: "There are many rules governing energy. Some of these produce cool observable effects and even record-breaking feats. Try your hand at the Galilean Cannon to discover how momentum is conserved and see how high you can propel the yellow ball!",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/energy/energy-carousel-images/energy-exhibition---solar-power.jpg",
        name: 'Solar Power',
        description: "Energy can be generated from natural sources, such as the Sun, which gives us solar power. Work with a partner to direct the lamp onto the solar-powered gliders and make them fly!",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/energy/energy-carousel-images/energy-exhibition---liquefied-natural-gas.jpg",
        name: 'Liquefied Natural Gas',
        description: "Fuel sources can be rarely used in their raw form. This interactive follows the transformation of raw natural gas to liquefied natural gas that we use to generate electricity.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/energy/energy-carousel-images/energy-exhibition---wind-turbine.jpg",
        name: "Singapore's Energy Story",
        description: "Discover Singapore's energy strategy for the future through our four switches - natural gas, solar power, regional power grids and low-carbon alternatives.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/energy/energy-carousel-images/energy-exhibition---future-power.jpg",
        name: "Power the City of the Future",
        description: "How will we power cities of the future? Challenge yourself as a single player or compete with friends in a multiplayer mode to see who can emerge a better planner by selecting the right mix of energy sources in this game.",
      },
    ]
  },
  {
    id: 1,
    name: 'Climate Changed',
    key: 'climate_changed',
    description: 'We are living in a changed world due to the consequences of climate change. There is still hope if everyone plays their part to avert this crisis. What will you do? Presented by Science Centre Singapore and supported by the Ministry of Sustainability and the Environment, the Climate Changed exhibition features two key zones – the Climate Action Show and Guilt Trip. Through multimedia displays, interactives, and immersive gameplay, visitors can learn about climate change and hopefully be more motivated to take urgent action to stem climate change and its impacts.',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/climate-change/banner-photo.jpg',
    hall: 'hall_b',
    mapPosition: { x: 15, y: 20 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/climate-change/climate-action-show_updated.jpg",
        name: 'Climate Action Show',
        description: "Become a Climate Change Agent! Join Sheepy and Felicity and uncover how you can start playing your part to address climate change in this interactive show.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/climate-change/guilt-trip_updated.jpg",
        name: 'Guilt Trip',
        description: "How do your daily habits contribute to climate change? Test your knowledge across 5 different categories – Water Consumption, Emissions, Technology and Electricity Consumption, Food Production and Waste, as well as Recyclability and Sustainability – and learn climate-friendly tips in this game.",
      },
    ]
  },
  {
    id: 5,
    name: 'Ecogarden',
    key: 'ecogarden',
    description: 'Learn about sustainable living and ecological balance. The Ecogarden, short for ecology garden, is a living outdoor laboratory.  The plants here receive no special care. No attempt is made to control pests except for occasional pruning, mowing and necessary replanting. This provides an excellent setting for ecological studies. From our local king of fruits, the durian, to the common vegetables that you get in the market, take a walk around nature and discover more about the plants that you commonly see.',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/eco-garden/teasers/ecogarden-teaser.jpg',
    hall: 'hall_d',
    mapPosition: { x: 20, y: 40 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/eco-garden/eu-yan-sang/image-in-content/healing-plants-area.jpg",
        name: 'Healing Plants for Natural Wellness',
        description: "Supported by Eu Yan Sang, the Ecogarden features many plants for their healing properties from the traditional Chinese medicine perspective. Some of these plants are also used by Malays and Indians in their traditional herbal medicine practices.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/eco-garden/ecogarden-highlight-01.jpg",
        name: 'Tree House',
        description: "Offering many elements of play and discovery like refuge, height, and physical challenge, this Tree house provides a gateway back to nature. Admire the panoramic view from atop!",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/eco-garden/ecogarden-highlight-02.jpg",
        name: 'Sweet Potato Plant',
        description: "A popular plant, the sweet potato is often eaten as a snack. Its leaves are used in vegetable dishes and its roots are used to make tonics. Don’t miss the chance to check it out and many other plants at the Ecogarden!",
      },
    ]
  },
  {
    id: 16,
    name: 'Singapore Innovations',
    key: 'singapore_innovations',
    description: 'What inspired the Singaporean innovations that have made their mark in the world? How did the innovators move from ideation to realisation? Find out about the science and engineering behind these innovations – and explore each journey from ideation to realisation.',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/singapore-innovations/teasers/singaporeinnovations-teaser.jpg',
    hall: 'hall_g',
    mapPosition: { x: 15, y: 15 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/singapore-innovations/highlights/singaporeinnovations-highlight-02.jpg",
        name: 'Vertical Farming System',
        description: "See an actual working model of the Vertical Farming System – an innovative way to grow vegetables where farmland is limited. Observe its patented water pulley system and how its intricate mechanism ensures that the veggies get adequate nutrients.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/singapore-innovations/highlights/singaporeinnovations-highlight-01.jpg",
        name: 'Rig by Keppel-FELS',
        description: "Did you know that Singapore, a country without oil and gas resources, is the world’s largest jackup rig manufacturer, that promotes oil exploitation? Be amazed by the huge jackup rig mock-up model and find out how it works!",
      },
    ]
  },
  {
    id: 8,
    name: 'Future Makers',
    key: 'future_makers',
    description: 'Engineering, the academic subject and the vocation, is much more than what it used to be. Learn the scope modern engineering offers to individuals and to society – from being highly specialised to highly specialised with multi-disciplinary, inter-disciplinary, and cross-disciplinary collaborations, from the conventional divisions to new divisions such as biomedical and nanotech materials fields.',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/engineering/highlights/future-makers---robot-show.jpg',
    hall: 'hall_g',
    mapPosition: { x: 80, y: 55 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/engineering/highlights/future-makers---robot-show.jpg",
        name: 'Robots at the Object Theatre',
        description: "Watch four industrial robotic arms carry large screens as they move to a video that tells the story of modern engineering and the issues they pose. ",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/engineering/highlights/future-makers---escape-rooms.jpg",
        name: 'Ginger Lily',
        description: "Experience Ginger Lily in a fun and safe way! Make your way to the spaceship with the five secret codes in hand. Apply your problem-solving wits to repair and reactivate the crashed spacecraft to save the world from an alien invasion.",
      },
    ]
  },
  {
    id: 7,
    name: 'Everyday Science',
    key: 'everyday_science',
    description: 'From the vast sky to the smallest microbe, there is science to be seen, felt, heard, and observed.',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/everyday-science/dsc_6491.jpg',
    hall: 'hall_d',
    mapPosition: { x: 60, y: 50 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/everyday-science/dsc_6480.jpg",
        name: 'Daylight Wonders',
        description: "Why is the sky blue? How do rainbows form? Take a stroll down the corridor of light and marvel at the different colours.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/everyday-science/dsc_6459(resize).jpg",
        name: 'Everyday Encounters',
        description: "Levitating balls and invisibility shields – this is not a movie! Try them out in our gallery.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/everyday-science/dsc_6352.jpg",
        name: 'Periodic Playground',
        description: "Our world is made up of tiny building blocks called the elements. Explore their various properties in this colourful zone.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/everyday-science/dsc_6428.jpg",
        name: 'The Garden',
        description: "Test out various properties of water, the liquid so important to life. Observe the diversity of the bacteria kingdom and notice the curious ways plants grow.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/everyday-science/dsc_6394-3.jpg",
        name: 'A Walk in the Night',
        description: "Get your flashlights out and navigate the foggy streets!",
      },
    ]
  },
  {
    id: 3,
    name: 'E3 - E-mmersive Experiential Environments',
    key: 'e3',
    description: 'Immerse yourself in some of the latest visualisation technologies on this journey from the ends of the universe to the recesses of our brains. E-mmersive Experiential Environments is an immersive exhibition featuring virtual reality headsets and 3D 360-degree environments. Using this technology, you will be taken on a journey to the outer reaches of the known universe, and into the deep recesses of the human brain.',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/e3-revamp/teaser/e3_teaser.jpg',
    hall: 'hall_c',
    mapPosition: { x: 55, y: 30 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/e3-revamp/highlights/hightlight_36027dbda87e49644a59406828fe8103952.jpg",
        name: '360 Wall Projection',
        description: "Step into a virtual forest built using the Unreal game engine and projection mapped onto the walls using real-time 3D rendering technology. In this environment, visitors will experience day and night transition, weather changes and interact with fishes along the central river.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/activities-workshops/visualisation-series/visualisation-table.jpg",
        name: 'Touch Table',
        description: "Learn and discover about live animals and human anatomy through powerful 3D visualizations, be curious as you digitally investigate the insides of objects like never before, all at the touch of your fingertips.",
      },
    ]
  },
  {
    id: 21,
    name: 'The Tinkering Studio',
    key: 'tinkering_studio',
    description: "Discover the magic of hands-on learning at Tinkering Studio Singapore! Dive into a world where creativity meets technology, fostering endless exploration and the joy of making. It's a space where imagination truly comes to life.",
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/tinkering-studio/teasers/tinkeringstudio-teaser.jpg',
    hall: 'hall_e',
    mapPosition: { x: 40, y: 40 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/tinkering-studio/carousel/tinkeringstudio-carousel-04.jpg",
        name: 'Pinball Machine',
        description: "Launch the pinball and watch it clear the obstacle you have set or see how many bells you can ring before the ball stops.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/tinkering-studio/highlights/tinkeringstudio-highlight-02.jpg",
        name: 'Wind Table',
        description: "Make your own light-weight flying designs using various materials and watch how they swirl, lift and glide over the wind table! It’s the most fun way to learn how wind can create lift!",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/tinkering-studio/carousel/tinkeringstudio-carousel-08.jpg",
        name: 'Marble Machine',
        description: "Come and build and explore the different materials and ways of building a path from top to bottom for your marble can travel!",
      },
    ]
  },
  {
    id: 9,
    name: 'Going Viral Travelling Exhibition',
    key: 'going_viral',
    description: 'Modern day pandemic interventions did not arise overnight. From antiquity to the present, countless individuals have contributed to the evolution of knowledge. Discover for yourself the arduous journey science has taken. But this is as much a story about viruses as about us humans and how we can all come together to build better futures.',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/going-viral-travelling-exhibition/dsc_5729.jpg',
    hall: 'hall_c',
    mapPosition: { x: 25, y: 60 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/going-viral-travelling-exhibition/dsc_5545.jpg",
        name: 'Let’s Get Quizzical!',
        description: "Test your knowledge as well as learn about the dangers of the infodemic.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/going-viral-travelling-exhibition/dsc_5422.jpg",
        name: 'Reflections from the Pandemic',
        description: "Pandemics are social – crises can bring the best out of people. Together we can build a kinder and more gracious society. Marvel at paper dioramas created specially for the exhibition by artist Cheryl Teo.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/going-viral-travelling-exhibition/dsc_5492.jpg",
        name: 'The Plague Doctor',
        description: "Find out why plague doctors wore these masks hundreds of years ago.",
      },
    ]
  },
  {
    id: 17,
    name: 'Smart Nation PlayScape',
    key: 'smart_nation',
    description: "What makes up a Smart Nation? What are the technologies powering Singapore's Smart Nation initiatives? The exhibition consists of eight technology zones. Through a series of gamified exhibits and multimedia elements, each zone gives an in-depth yet easy to understand explanation on how the technology came about, how it works, and its importance to Singapore today. The exhibition also provides an opt-in personalised experience, whereby one could collect digital stamps and snapshots of his/her own PlayScape journey through the various exhibits and get a soft copy of the digital 'PlayScape Passport' via email.",
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/smart-nation-playscape/dsc_1674.jpg',
    hall: 'hall_f',
    mapPosition: { x: 35, y: 20 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/smart-nation-playscape/dsc_1674.jpg",
        name: 'Geospatial',
        description: "Geospatial technology helps us better understand where things are in relation to one another, and how it can help us plan and build thriving communities. Add blocks representing different elements such as schools, houses, parks to the city, and observe how the quality-of-life changes!",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/smart-nation-playscape/dsc_1747.jpg",
        name: 'Make a Face!',
        description: "Do you appear ‘happier’ than your friends? Through biometric technology, computers can analyse your face and determine who makes the best expression!",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/smart-nation-playscape/dsc_1721.jpg",
        name: 'Rubik’s Cube solving robot',
        description: "Take a look at the steps that this robot takes to solve the Rubik’s cube that you messed up!",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/smart-nation-playscape/dsc_1813.jpg",
        name: 'The Cabinet of Curiosity',
        description: "A display of seemingly random daily items that actually relate to the various technologies and plays a part in building up our Smart Nation.",
      },
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/smart-nation-playscape/dsc_1824.jpg",
        name: 'PlayScape Passport – the personalised experience',
        description: "Choose to register yourself at the sign-up kiosks via biometric technology (facial recognition). Let the exhibits ‘recognise’ you and have your Playscape journey recorded in a digital Playscape Passport that you can email to yourself!",
      },
    ]
  },
];

export default function CameraToNavigationScreenPWA({ classifierMode = 'aricc' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [showCamera, setShowCamera] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState("");
  const [locationDetected, setLocationDetected] = useState(false);
  const [currentExhibit, setCurrentExhibit] = useState(null);
  const [detectionService, setDetectionService] = useState(null);
  const [lastDetection, setLastDetection] = useState(null);
  const [stableExhibitDetected, setStableExhibitDetected] = useState(false);
  const [stayOnCamera, setStayOnCamera] = useState(true); // Keep camera active by default
  const [showNavigation, setShowNavigation] = useState(false);
  const detectionIntervalRef = useRef(null);
  const detectionInFlightRef = useRef(false);
  const cameraStreamRef = useRef(null);
  const uploadedVideoRef = useRef(null);
  const acceptStreakRef = useRef(0);
  const rejectStreakRef = useRef(0);
  const pendingLabelRef = useRef("");
  const pendingLabelCountRef = useRef(0);
  const lastAcceptedAtRef = useRef(0);

  const stopCameraStream = () => {
    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject = null;
    }
  };

  // Live tracking state
  const [stepCount, setStepCount] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [currentDirection, setCurrentDirection] = useState('North-East');
  const [pathwayProgress, setPathwayProgress] = useState(0); // 0 to 1 along pathway
  const [isMovingTowardsTarget, setIsMovingTowardsTarget] = useState(false);
  const [distanceFromPath, setDistanceFromPath] = useState(0);
  const [currentWaypoint, setCurrentWaypoint] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading models...');
  const [statusMessage, setStatusMessage] = useState("");

  const formatDetectionStatus = (detection) => {
    if (!detection) return "";

    if (detection.reason === "main_classifier_unavailable") {
      const confidence = detection.exhibitConfidence !== undefined
        ? ` (${(detection.exhibitConfidence * 100).toFixed(1)}% exhibit)`
        : "";
      return `Gate accepted: main classifier missing${confidence}`;
    }

    if (detection.success) {
      const confidence = ((detection.zoneConfidence || detection.combinedConfidence || 0) * 100).toFixed(1);
      return `Accepted: ${detection.zone || "exhibit"} (${confidence}%)`;
    }

    const confidence = detection.exhibitConfidence !== undefined
      ? ` (${(detection.exhibitConfidence * 100).toFixed(1)}% exhibit)`
      : "";
    return `Rejected: ${detection.reason || "not exhibit"}${confidence}`;
  };

  const getStableExhibitLabel = () => {
    if (currentExhibit?.name && currentExhibit.name !== "Exhibit detected") return currentExhibit.name;
    if (currentExhibit?.zone) return currentExhibit.zone;
    if (
      lastDetection?.success &&
      !lastDetection.gateOnly &&
      lastDetection.exhibitInfo?.code !== "EXHIBIT" &&
      lastDetection.exhibitInfo?.displayName
    ) {
      return lastDetection.exhibitInfo.displayName;
    }
    return "";
  };

  // Update your initialization effect:
  useEffect(() => {
    const initService = async () => {
      try {
        setIsLoading(true);
        setLoadingMessage('Initializing exhibit detection service...');
        await exhibitDetectionService.initialize({ classifier: classifierMode });
        setDetectionService(exhibitDetectionService);
        window.exhibitDetectionService = exhibitDetectionService;
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
        setError(`Detection service initialization failed: ${error.message}`);
      }
    };

    initService();
  }, [classifierMode]);

  useEffect(() => {
    if (detectionService && uploadedVideoRef.current && !detectionIntervalRef.current) {
      startRealTimeDetection();
    }
  }, [detectionService]);

  // Point-based navigation state (removed drawing system)
  const [currentPathway, setCurrentPathway] = useState('DWT_to_EAP');

  // Update pathway based on current exhibit prediction
  useEffect(() => {
    if (currentExhibit) {
      const currentZone = getCurrentZone(currentExhibit);
      const nextZone = getNextZone(currentZone);
      const pathKey = `${currentZone}_to_${nextZone}`;
      setCurrentPathway(pathKey);
    }
  }, [currentExhibit]);
  const [isTracking, setIsTracking] = useState(true); // Enable tracking by default for testing
  const lastAccelerationRef = useRef(0);
  const lastStepTimeRef = useRef(0);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  // Live tracking initialization
  useEffect(() => {
    const startLiveTracking = async () => {
      try {
        // Request device motion permission for iOS
        if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
          const permission = await DeviceMotionEvent.requestPermission();
          if (permission !== 'granted') {
            console.log('Device motion permission denied');
            startSimulatedTracking();
            return;
          }
        }

        // Enhanced step detection with pathway tracking
        const handleDeviceMotion = (event) => {
          if (!event.accelerationIncludingGravity) return;

          const { x, y, z } = event.accelerationIncludingGravity;
          const magnitude = Math.sqrt(x * x + y * y + z * z);

          // Enhanced step detection algorithm
          const now = Date.now();
          const stepThreshold = 12; // Adjusted for web

          if (magnitude > stepThreshold &&
              magnitude > lastAccelerationRef.current &&
              now - lastStepTimeRef.current > 500) { // Minimum 500ms between steps

            // Update basic step tracking
            setStepCount(prev => {
              const newStepCount = prev + 1;

              // Update pathway progress based on movement direction
              updatePathwayProgress(newStepCount);

              return newStepCount;
            });

            setTotalDistance(prev => prev + 0.75); // Average step length ~0.75m
            lastStepTimeRef.current = now;

            // Log movement for debugging
            console.log(`👣 Step detected: ${stepCount + 1}, Direction: ${currentDirection}, Pathway: ${currentPathway}`);
          }
          lastAccelerationRef.current = magnitude;
        };

        // Set up direction detection using deviceorientation
        const handleDeviceOrientation = (event) => {
          if (event.alpha !== null) {
            let heading = event.alpha;
            if (heading < 0) heading += 360;

            // Convert heading to cardinal direction
            let direction = 'North';
            if (heading >= 315 || heading < 45) direction = 'North';
            else if (heading >= 45 && heading < 135) direction = 'East';
            else if (heading >= 135 && heading < 225) direction = 'South';
            else if (heading >= 225 && heading < 315) direction = 'West';

            // Add intermediate directions
            if (heading >= 22.5 && heading < 67.5) direction = 'North-East';
            else if (heading >= 67.5 && heading < 112.5) direction = 'East';
            else if (heading >= 112.5 && heading < 157.5) direction = 'South-East';
            else if (heading >= 157.5 && heading < 202.5) direction = 'South';
            else if (heading >= 202.5 && heading < 247.5) direction = 'South-West';
            else if (heading >= 247.5 && heading < 292.5) direction = 'West';
            else if (heading >= 292.5 && heading < 337.5) direction = 'North-West';

            setCurrentDirection(direction);
          }
        };

        // Add event listeners
        window.addEventListener('devicemotion', handleDeviceMotion);
        window.addEventListener('deviceorientation', handleDeviceOrientation);

        setIsTracking(true);
        console.log('🚶 Live tracking started');

        // Cleanup function
        return () => {
          window.removeEventListener('devicemotion', handleDeviceMotion);
          window.removeEventListener('deviceorientation', handleDeviceOrientation);
          setIsTracking(false);
        };

      } catch (error) {
        console.log('Live tracking not available:', error);
        startSimulatedTracking();
      }
    };

    const startSimulatedTracking = () => {
      // Simulated movement for desktop testing
      const interval = setInterval(() => {
        if (Math.random() > 0.8) { // 20% chance of "step" per second
          setStepCount(prev => prev + 1);
          setTotalDistance(prev => prev + 0.75);
        }

        // Rotate direction occasionally
        if (Math.random() > 0.95) {
          const directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
          setCurrentDirection(directions[Math.floor(Math.random() * directions.length)]);
        }
      }, 1000);

      setIsTracking(true);
      console.log('🎲 Simulated tracking started for desktop');

      return () => clearInterval(interval);
    };

    const cleanup = startLiveTracking();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Request camera access for live recognition. Uploaded files take precedence.
  useEffect(() => {
    if (!showCamera || !detectionService || uploadedVideoRef.current || !videoRef.current) return undefined;

    let cancelled = false;
    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access is not supported in this browser. Upload a video instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        startRealTimeDetection();
      } catch (cameraError) {
        console.error('Camera error:', cameraError);
        const message = cameraError.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access or upload a video.'
          : 'Camera could not be started. Upload a video instead.';
        setError(message);
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopRealTimeDetection();
      stopCameraStream();
    };
  }, [showCamera, detectionService]);

  // Upload a video file for testing instead of using the live camera
  const handleVideoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || !videoRef.current) return;

    stopRealTimeDetection();
    const video = videoRef.current;
    uploadedVideoRef.current = file;
    stopCameraStream();
    setError("");
    video.src = URL.createObjectURL(file);
    video.loop = true;
    video.muted = true;
    video.onloadedmetadata = () => {
      video.play().then(() => {
        startRealTimeDetection();
      }).catch((playError) => {
        setError(`Video playback failed: ${playError.message}`);
      });
    };
    video.onerror = () => setError('The selected video could not be loaded.');
  };

  // Start real-time detection
  const startRealTimeDetection = () => {
    if (!detectionService || !videoRef.current) return;

    console.log('🚀 Starting continuous real-time exhibit detection...');
    setStatusMessage('Starting continuous real-time exhibit detection...');
    setIsDetecting(true);

    // Run detection every 2 seconds for better performance and stability
    detectionIntervalRef.current = setInterval(async () => {
      await performDetection();
    }, 1500);

    // Also run an immediate detection after video is ready
    // setTimeout(() => performDetection(), 2000);
    setTimeout(() => setStatusMessage(''), 1200); // Clear after 1.2s
  };

  // Stop real-time detection
  const stopRealTimeDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
      console.log('⏸️ Stopped real-time detection');
    }
    setIsDetecting(false);
  };

  // Perform a single detection
  // const performDetection = async () => {
  //   if (!detectionService || !videoRef.current) return;
  
  //   try {
  //     const canvas = document.createElement("canvas");
  //     canvas.width = 224;
  //     canvas.height = 224;
  //     const ctx = canvas.getContext("2d");
  //     ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

  //     console.log('🎯 Starting hierarchical detection...');
  //     const detection = await detectionService.detectHierarchical(canvas);
  //     console.log('✅ Hierarchical detection completed:', detection);
  //     setLastDetection(detection);
  
  //     console.log('🔍 Real-time detection result:', detection);

  //     if (detection.success && detection.combinedConfidence > 0.1) { // Lower threshold for testing
  //       // Create hierarchical exhibit object for real-time detection
  //       const hierarchicalExhibit = {
  //         id: detection.exhibitInfo.number,
  //         name: detection.exhibitInfo.displayName,
  //         key: detection.exhibitInfo.code.toLowerCase(),
  //         zone: detection.zone,
  //         exhibitInfo: detection.exhibitInfo,
  //         coordinates: detection.coordinates,
  //         confidence: detection.combinedConfidence
  //       };
  //       setCurrentExhibit(hierarchicalExhibit);
  //       setLocationDetected(true);
  //       console.log(`✅ Real-time: ${detection.zone} → ${detection.exhibitInfo.displayName} (${(detection.combinedConfidence * 100).toFixed(1)}%)`);
  //     }
  //   } catch (error) {
  //     console.error("❌ Real-time detection failed:", error);
  //     setError(`Detection failed: ${error.message}`);
  //     // Continue detection despite error
  //   }
  // };

  const performDetection = async () => {
  if (!detectionService || !videoRef.current || detectionInFlightRef.current) return;

  detectionInFlightRef.current = true;
  try {
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      return;
    }

    console.log("🎯 Starting hierarchical detection...");
    if (!lastDetection) {
      setStatusMessage("Analyzing image...");
      setTimeout(() => setStatusMessage(""), 600);
    }
    const detection = await detectionService.detectHierarchical(video);
    setLastDetection(detection);
    console.log("✅ Hierarchical detection completed:", detection);

    if (!detection.success) {
      acceptStreakRef.current = 0;
      rejectStreakRef.current += 1;
      if (detection.classifier === 'aricc' || detection.zone === 'ARICC') {
        setCurrentExhibit(null);
        setStableExhibitDetected(false);
        setLocationDetected(false);
      }
      if (rejectStreakRef.current >= 2 && !currentExhibit) {
        setStableExhibitDetected(false);
        setLocationDetected(false);
      }

      if (detection.reason === 'noise_rejected') {
        setStatusMessage(`No exhibit detected (${((detection.exhibitConfidence || 0) * 100).toFixed(1)}% exhibit)`);
        console.log("Binary gate rejected frame as noise/background.");
        console.log(`   Exhibit confidence: ${((detection.exhibitConfidence || 0) * 100).toFixed(1)}%`);
        console.log(`   Required confidence: ${((detection.requiredConfidence || 0.6) * 100).toFixed(0)}%`);
      } else if (detection.reason === 'poor_frame_quality') {
        setStatusMessage(`Poor frame quality: ${detection.clarityReason || 'try a clearer view'}`);
        console.log("🎥 Clarity gate: Poor frame quality detected — hiding exhibit.");
        console.log(`   Reason: ${detection.clarityReason}`);
        console.log(`   Brightness: ${detection.brightness?.toFixed(3) || 'N/A'}`);
        console.log(`   Edge variance: ${detection.edgeVariance?.toFixed(4) || 'N/A'}`);
        console.log(`   Contrast: ${detection.contrast?.toFixed(3) || 'N/A'}`);
      } else if (detection.reason === 'main_classifier_unavailable') {
        console.log("Gate accepted the frame, but the main classifier is unavailable.");
      } else if (detection.reason === 'low_main_confidence') {
        setStatusMessage(`Zone uncertain (${((detection.mainConfidence || 0) * 100).toFixed(1)}% zone confidence)`);
        console.log("🚫 Zone confidence too low.");
      } else if (detection.reason === 'low_specific_confidence') {
        setStatusMessage(`Exhibit uncertain (${((detection.specificConfidence || 0) * 100).toFixed(1)}% match)`);
        console.log("🚫 Specialist confidence too low.");
      } else if (detection.reason === 'unknown_exhibit') {
        setCurrentExhibit(null);
        setStableExhibitDetected(false);
        setLocationDetected(false);
        setStatusMessage('No exhibit detected');
        console.log("🚫 Unknown exhibit: no confident ARICC/RECON class match.");
      } else if (detection.reason === 'no_exhibit_detected') {
        setStatusMessage(`No exhibit detected (${((detection.maxConfidence || 0) * 100).toFixed(1)}% max confidence)`);
        console.log("🚫 Confidence filter: Low confidence background detected in frame — hiding exhibit.");
        console.log(`   Max confidence: ${(detection.maxConfidence * 100).toFixed(1)}% (below 75% threshold)`);
      } else if (detection.isLikelyBackground) {
        setStatusMessage("Background/noise detected");
        console.log("🚫 Background/noise detected — hiding exhibit.");
        const mainGap = Number.isFinite(detection.mainConfidenceGap) ? detection.mainConfidenceGap : 0;
        const specificGap = Number.isFinite(detection.specificConfidenceGap)
          ? detection.specificConfidenceGap
          : mainGap;
        console.log(`   Main confidence gap: ${(mainGap * 100).toFixed(1)}%`);
        console.log(`   Specific confidence gap: ${(specificGap * 100).toFixed(1)}%`);
      } else {
        setStatusMessage("Detection not successful");
        console.log("⚠️ Detection not successful — hiding exhibit.");
      }
      setTimeout(() => setStatusMessage(""), 1500);
      // Keep the last confirmed exhibit visible, matching the reference behavior.
      // Noise/floor frames should not erase the label at the top of the camera.
      return;
    }

    const combinedConfidence = detection.combinedConfidence || detection.zoneConfidence || 0;
    const SHOW_THRESHOLD = 0.6;
    const detectedName = detection.exhibitInfo?.displayName || detection.exhibit || "";
    const detectedZone = detection.zone || "";
    const hasRealLabel = Boolean(
      detectedZone &&
      detectedName &&
      detectedName !== "Exhibit detected" &&
      detection.exhibitInfo?.code !== "EXHIBIT" &&
      !detection.gateOnly
    );

    console.log(
      `🔍 Combined confidence: ${(combinedConfidence * 100).toFixed(1)}% (${detection.zone} / ${detection.exhibitInfo?.displayName || detection.exhibit})`
    );

    if (!hasRealLabel || combinedConfidence < SHOW_THRESHOLD) {
      setCurrentExhibit(null);
      setStableExhibitDetected(false);
      setLocationDetected(false);
      console.log("Ignoring detection because it is generic or below the display threshold.");
      return;
    }

    const labelKey = `${detectedZone}:${detectedName}`;
    if (pendingLabelRef.current === labelKey) {
      pendingLabelCountRef.current += 1;
    } else {
      pendingLabelRef.current = labelKey;
      pendingLabelCountRef.current = 1;
    }

    const isSwitchingLabel = Boolean(currentExhibit?.name && currentExhibit.name !== detectedName);
    const requiredHits = isSwitchingLabel ? 3 : 2;
    const switchCooldownActive = isSwitchingLabel &&
      Date.now() - lastAcceptedAtRef.current < 4000;

    if (!switchCooldownActive && pendingLabelCountRef.current >= requiredHits) {
      const exhibit = {
        id: detection.exhibitInfo?.number || '00',
        name: detectedName,
        key: (detection.exhibitInfo?.code || detection.exhibit || '').toLowerCase(),
        zone: detectedZone,
        exhibitInfo: detection.exhibitInfo,
        coordinates: detection.coordinates,
        confidence: combinedConfidence,
      };

      setCurrentExhibit(exhibit);
      setLocationDetected(true);
      setStableExhibitDetected(true);
      lastAcceptedAtRef.current = Date.now();
      acceptStreakRef.current += 1;
      rejectStreakRef.current = 0;

      console.log(
        `🏆 Exhibit detected: ${detection.zone} → ${exhibit.name} (${(combinedConfidence * 100).toFixed(1)}%)`
      );
    }
    if (canvasRef.current) {
      const overlayCtx = canvasRef.current.getContext('2d');
      overlayCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  } catch (err) {
    console.error("❌ Real-time detection failed:", err);
    setError(`Detection failed: ${err.message}`);
  } finally {
    detectionInFlightRef.current = false;
  }
};


  

  // Manual detection (keep for backup/testing)
  const handleDetectLocation = async () => {
    setIsDetecting(true);
    setError("");

    try {
      // Initialize the service if not already done
      if (!window.exhibitDetectionService) {
        const { default: exhibitDetectionService } = await import(/* @vite-ignore */ './services/exhibitDetectionService.js?v=' + Date.now());
        await exhibitDetectionService.initialize({ classifier: classifierMode });
        window.exhibitDetectionService = exhibitDetectionService;
      }

      // Capture frame from video
      if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 224;  // Model input size
        canvas.height = 224;
        const ctx = canvas.getContext('2d');

        // Draw current video frame to canvas
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        // Run detection
        const detection = await window.exhibitDetectionService.detectHierarchical(canvas);

        console.log('🏛️ Detection result:', detection);

        // Handle hierarchical detection results
        if (detection.success && detection.combinedConfidence > 0.1) {
          // Create hierarchical exhibit object for manual detection
          const hierarchicalExhibit = {
            id: detection.exhibitInfo.number,
            name: detection.exhibitInfo.displayName,
            key: detection.exhibitInfo.code.toLowerCase(),
            zone: detection.zone,
            exhibitInfo: detection.exhibitInfo,
            coordinates: detection.coordinates,
            confidence: detection.combinedConfidence
          };

          setLocationDetected(true);
          setShowCamera(false);
          setCurrentExhibit(hierarchicalExhibit);
          console.log(`✅ Manual detection: ${detection.zone} → ${detection.exhibitInfo.displayName} (${(detection.combinedConfidence * 100).toFixed(1)}%)`);
        } else {
          // If confidence is low, show the best guess but with a warning
          const bestGuess = exhibitPath[0]; // Default fallback

          setLocationDetected(true);
          setShowCamera(false);
          setCurrentExhibit(bestGuess);
          setError(`Low confidence detection (${(detection.combinedConfidence * 100).toFixed(1)}%). Result may be inaccurate.`);
        }
      }

    } catch (error) {
      console.error('❌ Detection failed:', error);
      setError(`Detection failed: ${error.message}`);

      // Fallback to first exhibit
      setLocationDetected(true);
      setShowCamera(false);
      setCurrentExhibit(exhibitPath[0]);

    } finally {
      setIsDetecting(false);
    }
  };

  const handleDetectAgain = () => {
    setLocationDetected(false);
    setShowCamera(true);
    setCurrentExhibit(null);
    setStableExhibitDetected(false);
    acceptStreakRef.current = 0;
    rejectStreakRef.current = 0;
    pendingLabelRef.current = "";
    pendingLabelCountRef.current = 0;
    setError("");
    setLastDetection(null);
    setShowNavigation(false);
    // Real-time detection will restart automatically when camera shows
    console.log('🔄 Restarting automatic detection...');
  };

  const handleShowNavigation = () => {
    if (currentExhibit) {
      // Update navigation service with current exhibit
      const exhibit = aiNavigationService.findExhibitByName(currentExhibit.name);
      if (exhibit) {
        aiNavigationService.markExhibitVisited(exhibit.id);
      }
    }
    setShowNavigation(true);
  };

  const handleBackFromNavigation = () => {
    setShowNavigation(false);
  };

  const handleExhibitSelect = (exhibit) => {
    console.log('Selected exhibit for navigation:', exhibit);
  };

  // Get unique map image for current exhibit (from React Native implementation)
  // Simple map system using actual local images
  const getCurrentZone = (exhibit) => {
    if (!exhibit) return 'DWT';

    // Check if it's from hierarchical detection
    if (exhibit.zone) {
      return exhibit.zone;
    }

    // Fallback based on exhibit key/name
    const exhibitStr = exhibit.key || exhibit.name || '';
    if (exhibitStr.includes('dialogue') || exhibitStr.includes('DWT')) return 'DWT';
    if (exhibitStr.includes('earth') || exhibitStr.includes('EAP')) return 'EAP';
    if (exhibitStr.includes('EGN')) return 'EGN';

    return 'DWT'; // Default
  };

  const getNextZone = (currentZone) => {
    // Navigation flow: DWT → EAP → EGN → EAP
    const zoneFlow = {
      'DWT': 'EAP',
      'EAP': 'EGN',
      'EGN': 'EAP'
    };
    return zoneFlow[currentZone] || 'EAP';
  };

  // Multi-point pathway coordinates - avoiding walls and obstacles
  // Each path can have 5+ waypoints to navigate around walls properly
  const pathCoordinates = {
    // DWT to EAP - Final user-marked path avoiding walls
    'DWT_to_EAP': [
      { x: 47.4, y: 26.7 }, // Point 1: Start at DWT
      { x: 55.2, y: 26.7 }, // Point 2: Move horizontally
      { x: 55.2, y: 50.0 }, // Point 3: Turn down corridor
      { x: 52.3, y: 54.7 }, // Point 4: Navigate to EAP area
      { x: 48.7, y: 59.3 }  // Point 5: End at EAP
    ],
    // EAP to EGN - Final user-marked path avoiding walls
    'EAP_to_EGN': [
      { x: 46.4, y: 51.2 }, // Point 1: Start at EAP
      { x: 50.0, y: 48.8 }, // Point 2: Navigate corridor
      { x: 53.9, y: 51.2 }, // Point 3: Continue through passage
      { x: 57.8, y: 53.5 }, // Point 4: Approach EGN area
      { x: 61.8, y: 52.3 }  // Point 5: End at EGN
    ],
    // EGN to EAP - Final user-marked return path avoiding walls
    'EGN_to_EAP': [
      { x: 61.1, y: 54.7 }, // Point 1: Start at EGN
      { x: 56.2, y: 53.5 }, // Point 2: Move towards center
      { x: 53.3, y: 53.5 }, // Point 3: Navigate corridor junction
      { x: 50.0, y: 53.5 }, // Point 4: Continue through passage
      { x: 46.4, y: 52.3 }  // Point 5: End at EAP
    ]
  };

  // Polyline path tracking system using exact Science Centre Hall B SVG coordinates
  const getNavigationPath = (currentZone, nextZone) => {
    const pathKey = `${currentZone}_to_${nextZone}`;
    return pathCoordinates[pathKey] || [];
  };

  // Calculate progress along path based on steps
  const getPathProgress = (stepCount, totalSteps = 160) => {
    return Math.min(stepCount / totalSteps, 1); // 0 to 1
  };

  // Get current position on path based on progress
  const getCurrentPathPosition = (path, progress) => {
    if (!path || path.length === 0) return null;

    const segmentLength = 1 / (path.length - 1);
    const segmentIndex = Math.floor(progress / segmentLength);
    const segmentProgress = (progress % segmentLength) / segmentLength;

    if (segmentIndex >= path.length - 1) {
      return path[path.length - 1];
    }

    const start = path[segmentIndex];
    const end = path[segmentIndex + 1];

    return {
      x: start.x + (end.x - start.x) * segmentProgress,
      y: start.y + (end.y - start.y) * segmentProgress
    };
  };

  // Calculate expected direction between two points (in degrees)
  const calculateBearing = (point1, point2) => {
    const deltaX = point2.x - point1.x;
    const deltaY = point2.y - point1.y;
    let bearing = Math.atan2(deltaX, deltaY) * (180 / Math.PI);
    if (bearing < 0) bearing += 360;
    return bearing;
  };

  // Convert direction string to degrees
  const directionToDegrees = (direction) => {
    const directionMap = {
      'North': 0,
      'North-East': 45,
      'East': 90,
      'South-East': 135,
      'South': 180,
      'South-West': 225,
      'West': 270,
      'North-West': 315
    };
    return directionMap[direction] || 0;
  };

  // Calculate if user is moving towards the target along the pathway
  const updatePathwayProgress = (newStepCount) => {
    const currentPath = pathCoordinates[currentPathway];
    if (!currentPath || currentPath.length === 0) return;

    // Calculate current progress along path
    const totalPathSteps = 160; // Total steps to complete pathway
    const progress = Math.min(newStepCount / totalPathSteps, 1);
    setPathwayProgress(progress);

    // Get current and next waypoints
    const waypointIndex = Math.floor(progress * (currentPath.length - 1));
    const nextWaypointIndex = Math.min(waypointIndex + 1, currentPath.length - 1);

    setCurrentWaypoint(waypointIndex);

    if (waypointIndex < currentPath.length - 1) {
      // Calculate expected direction to next waypoint
      const currentPoint = currentPath[waypointIndex];
      const nextPoint = currentPath[nextWaypointIndex];
      const expectedBearing = calculateBearing(currentPoint, nextPoint);

      // Convert user's current direction to degrees
      const userBearing = directionToDegrees(currentDirection);

      // Calculate difference between expected and actual direction
      let bearingDiff = Math.abs(expectedBearing - userBearing);
      if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;

      // User is moving towards target if within 45 degrees of expected direction
      const isMovingCorrectly = bearingDiff <= 45;
      setIsMovingTowardsTarget(isMovingCorrectly);

      // Calculate distance from path (simplified)
      const pathDistance = bearingDiff / 180; // 0 to 1 scale
      setDistanceFromPath(pathDistance);

      // Log pathway tracking info
      console.log(`🧭 Pathway tracking:
        Progress: ${(progress * 100).toFixed(1)}%
        Waypoint: ${waypointIndex}/${currentPath.length - 1}
        Expected: ${expectedBearing.toFixed(0)}°
        Actual: ${userBearing.toFixed(0)}°
        Diff: ${bearingDiff.toFixed(0)}°
        On Track: ${isMovingCorrectly ? '✅' : '❌'}`);
    }
  };

  const getMapImageForExhibit = (exhibit) => {
    const currentZone = getCurrentZone(exhibit);

    // Use local PNG images for each zone - show the CURRENT zone's map
    const mapImages = {
      'DWT': '/images/DWT_Map.png',
      'EAP': '/images/EAP_Map.png',
      'EGN': '/images/EGN_Map.png'
    };

    return mapImages[currentZone] || '/images/DWT_Map.png';
  };

  const handleNextExhibit = () => {
    const idx = exhibits.findIndex((e) => e.id === currentExhibit?.id);
    const next = exhibits[(idx + 1) % exhibits.length];
    setCurrentExhibit(next);
  };

  const navigationInfo = { distance: 120, steps: 160, direction: "North-East" };

  // Show navigation if requested
  if (showNavigation) {
    return (
      <AINavigation
        onBack={handleBackFromNavigation}
        detectedExhibit={currentExhibit}
        onExhibitSelect={handleExhibitSelect}
      />
    );
  }

  return (
    <div style={{ flex: 1, position: "relative", height: "100vh", overflow: "hidden" }}>
      {isLoading && (
        <div style={{ position: "absolute",
      top: 32,
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(255,255,255,0.95)",
      borderRadius: 8,
      zIndex: 1002,
      padding: "14px 32px",
      fontWeight: "bold",
      fontSize: 18,
      color: "#2196f3",
      boxShadow: "0 2px 12px rgba(0,0,0,0.10)" }}>
          {loadingMessage}
        </div>
    )}
    {false && statusMessage && (
  <div style={{
    position: "absolute",
    top: isLoading ? 72 : 32,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(255,255,200,0.95)",
    borderRadius: 8,
    zIndex: 1200,
    padding: "12px 26px",
    fontWeight: "bold",
    fontSize: 16,
    color: "#444",
    boxShadow: "0 2px 12px rgba(0,0,0,0.10)"
  }}>
    {statusMessage}
  </div>
)}
    {getStableExhibitLabel() && (
  <div style={{
    position: "absolute",
    top: isLoading ? 120 : 32,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(0,0,0,0.72)",
    borderRadius: 8,
    zIndex: 1200,
    padding: "8px 18px 10px",
    fontWeight: "bold",
    color: "#fff",
    boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
    textAlign: "center",
    minWidth: 180,
    maxWidth: "86vw"
  }}>
    <div style={{
      fontSize: 11,
      opacity: 0.78,
      lineHeight: 1.1,
      marginBottom: 3,
      textTransform: "uppercase"
    }}>
      Exhibit detected
    </div>
    <div style={{
      fontSize: 17,
      lineHeight: 1.15,
      overflowWrap: "anywhere"
    }}>
      {getStableExhibitLabel()}
    </div>
  </div>
)}
      {/* Upload video for testing (replaces the live camera feed) */}
      <div style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 1300,
      }}>
        <label style={{
          background: "rgba(0,0,0,0.72)",
          color: "#fff",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: "bold",
          cursor: "pointer",
        }}>
          Upload test video
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {/* Video element now driven by an uploaded file instead of the live camera */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      />
      <canvas
  ref={canvasRef}
  width={window.innerWidth}
  height={window.innerHeight}
  style={{
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: 2, // above video, below UI overlays
  }}
/>
  
      {/* Dark overlay to improve text contrast */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.3)",
          zIndex: 1,
        }}
      />

      {false && <div
        style={{
          position: "fixed",
          left: 12,
          right: 12,
          bottom: 12,
          zIndex: 5000,
          background: "rgba(255,255,255,0.96)",
          color: "#222",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "0 4px 18px rgba(0,0,0,0.25)",
          lineHeight: 1.35
        }}
      >
        <div>
          Model: {isLoading ? loadingMessage : detectionService ? "ready" : "not ready"}
        </div>
        <div>
          Camera: {videoRef.current?.srcObject ? "active" : showCamera ? "waiting for permission/stream" : "off"}
        </div>
        <div>
          Detection: {lastDetection
            ? formatDetectionStatus(lastDetection)
            : isDetecting ? "running, waiting for first result" : "not running"}
        </div>
        {lastDetection?.gate && (
          <div>
            Gate: background {((lastDetection.gate.backgroundConfidence || 0) * 100).toFixed(1)}% / exhibit {((lastDetection.gate.exhibitConfidence || 0) * 100).toFixed(1)}%
          </div>
        )}
        {lastDetection?.gate?.rawOutput && (
          <div>
            Raw gate: {lastDetection.gate.rawOutput.map(value => Number(value).toFixed(3)).join(", ")}
          </div>
        )}
        {error && <div style={{ color: "#b71c1c" }}>Error: {error}</div>}
      </div>}


      {/* Smaller Exhibit Details Card */}

      {/* Map to Next Exhibit with Polyline Navigation */}
        {false && currentExhibit && (
          <div
            style={{
              marginTop: 20,
              backgroundColor: "#fff",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid #e9ecef",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: "bold", color: "#333" }}>
                📍 Navigation to Next Exhibit
              </h3>
            </div>

            {/* Current Zone and Next Destination */}
            <div style={{
              backgroundColor: "#f8f9fa",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: 12,
              border: "1px solid #e9ecef"
            }}>
              <div style={{ fontSize: "14px", marginBottom: 8 }}>
                <strong>Current Zone:</strong> {getCurrentZone(currentExhibit)}
              </div>
              <div style={{ fontSize: "14px", color: "#FF6B35", fontWeight: "bold" }}>
                <strong>Next Destination:</strong> {getNextZone(getCurrentZone(currentExhibit))}
              </div>
            </div>

            {/* Live Tracking Stats */}
            <div
              style={{
                backgroundColor: "#f8f9fa",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #e9ecef",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                  fontSize: "14px",
                  color: isTracking ? "#28a745" : "#6c757d",
                }}
              >
                <span>📍</span>
                <span>{isTracking ? "Live Tracking Active" : "Live Tracking Unavailable"}</span>
              </div>

              <div style={{ fontSize: "13px", lineHeight: "1.6" }}>
                <div><strong>Distance:</strong> {Math.max(0, 120 - Math.round(totalDistance))} m (Live)</div>
                <div><strong>Steps:</strong> ~{Math.max(0, 160 - stepCount)} (Tracked: {stepCount})</div>
                <div><strong>Direction:</strong> {currentDirection}</div>
                <div><strong>Progress:</strong> {Math.round(pathwayProgress * 100)}%</div>
                <div><strong>Waypoint:</strong> {currentWaypoint + 1}/{pathCoordinates[currentPathway]?.length || 0}</div>
                <div style={{
                  color: isMovingTowardsTarget ? "#28a745" : "#dc3545",
                  fontWeight: "bold"
                }}>
                  <strong>Status:</strong> {isMovingTowardsTarget ? "✅ On Track" : "❌ Off Track"}
                </div>
                <div><strong>Path Alignment:</strong> {((1 - distanceFromPath) * 100).toFixed(0)}%</div>
              </div>

              {/* Manual Step Controls for Testing */}
              <div style={{
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: "1px solid #e9ecef",
                display: "flex",
                gap: "8px",
                justifyContent: "center"
              }}>
                <button
                  onClick={() => setStepCount(Math.max(0, stepCount - 10))}
                  style={{
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: "pointer"
                  }}
                >
                  -10 Steps
                </button>
                <button
                  onClick={() => setStepCount(stepCount + 10)}
                  style={{
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: "pointer"
                  }}
                >
                  +10 Steps
                </button>
                <button
                  onClick={() => setStepCount(0)}
                  style={{
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: "pointer"
                  }}
                >
                  Reset
                </button>
              </div>

              {isTracking && (
                <div
                  style={{
                    marginTop: "8px",
                    paddingTop: "8px",
                    borderTop: "1px solid #e9ecef",
                    fontSize: "12px",
                    color: "#6c757d",
                  }}
                >
                  Total Distance Walked: {totalDistance.toFixed(1)}m
                </div>
              )}
            </div>

          </div>
        )}

      {/* Detection Overlay */}
      {/* {isDetecting && lastDetection && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 3,
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "12px 20px",
            borderRadius: 12,
            minWidth: 260,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>
            🎯 Auto-Detecting Exhibits
          </div>
          {lastDetection.allDetections?.map((detection, index) => {
            const confidence = (detection.confidence * 100).toFixed(1);
            return (
              <div key={index} style={{ fontSize: 14, marginBottom: 4 }}>
                {detection.exhibit || detection.class}: {confidence}%
              </div>
            );
          })}
        </div>

      )} */}
    </div>
  );
}
const styles = {
  cameraOverlay: {
  position: "absolute",
  top: 0, right: 0, bottom: 0, left: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(0,0,0,0.3)",
  zIndex: 2
  },
  pathContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    padding: '10px 15px',
    backgroundColor: '#007BFF',
    color: '#fff',
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 16,
    zIndex: 10,
  },
  displayText: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingBottom: 10,
  },
};
