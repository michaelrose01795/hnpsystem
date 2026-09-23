// file location: src/features/website/data/blogPosts.js
//
// Cards for the "Help & Advice" block on /website (the section the top bar
// still labels Blog, anchor #blog).
//
// The job of this section is to answer the questions customers actually ring
// up and ask - what a service includes, what an MOT advisory means, whether
// PCP or HP suits them - and to show where we can help with each one. Every
// card carries a "More info" button that opens the full answer in a popup, so
// the section stays scannable and nobody has to leave the page to read it.
//
// This section is 100% code-owned: the array below is the ONE place the cards
// come from. The public page does not read them out of the database - see
// the register in src/features/website/data/codeOwnedContent.js -
// so what is written here is exactly what renders, every time, with no DB
// round-trip and nothing to publish. It has to work this way: `detail` below
// is a nested structure (headed sections, a checklist, a call to action) and
// website_blog_posts has no columns for any of it - it stores one flat `body`
// string (see blogOut in src/lib/database/website.js).
//
// These eight entries are MOCK data standing in until the real copy is signed
// off. Changing them is a code edit and nothing else:
//
//   - add a card     append an object to the array
//   - remove a card  delete its object
//   - reorder        move the objects - they render top-left to bottom-right
//   - reword         edit any string in place
//
// Images: `image` is a plain string that goes straight into the card's
// <img src>, so anything the browser can load works -
//
//   - an absolute URL on the dealer CDN (what the entries below use), or
//   - a file dropped into /public, referenced from the site root,
//     e.g. "/website/help/what-is-a-service.jpg"
//
// The URLs below are real, currently-serving dealer CDN images reused from
// elsewhere on the site, so every card renders a picture today: all eight are
// different, and each is the closest existing shot to its subject (the
// warranty card gets the 10-year warranty banner, Motability gets the staff
// photo, and so on). They are still PLACEHOLDERS - swap each for commissioned
// artwork when the photography is ready. Two notes if you go looking for more
// in the CDN: the six ".../humphries---parks-blog-.jpg" URLs are all the SAME
// showroom photo with a caption burnt into it (only one is used here, on the
// last card), and the "q2-2026-uk-vitara_facelift" banner 404s at the size the
// rest of the site requests. The card art is cropped to 16/10 with object-fit:
// cover (.ws-help-media in src/styles/custglobal.css), so any aspect ratio is
// safe; landscape around 1920x873 crops best. `title` doubles as the image's
// alt text, so keep it descriptive.
//
// Fields:
//   id         stable unique key for React - kebab-case, never reused
//   category   short chip above the title, e.g. "Servicing" - group cards by
//              repeating the same value
//   title      the question the card answers
//   date       freshness line on the card, free text e.g. "Updated July 2026"
//   readTime   rough length, shown next to the date - omit to hide it
//   excerpt    one or two sentences of card copy, above the More info button
//   image      card art (see above)
//   detail     what the popup shows:
//     lead       opening paragraph, set slightly larger
//     sections   [{ heading, body: [paragraph, ...] }] - the main answer
//     checklist  optional { heading, items: [string, ...] } tick list
//     cta        optional { label, href, note } - the popup's footer action.
//                `href` takes an in-page anchor ("#contact"), a route
//                ("/website/valuation") or a tel:/mailto: link.

export const blogPosts = [
  {
    id: "what-happens-at-a-service",
    category: "Servicing",
    title: "What actually happens at a service - and what it costs",
    date: "Updated July 2026",
    readTime: "4 min read",
    excerpt:
      "An interim service is not a full service, and neither is an MOT. Here is what each one covers, so you can tell whether you are being sold something you do not need.",
    image:
      "https://images.67degreescdn.co.uk/kWdMmJColsQoohYLdV5U2GoGoA0=/479x479/smart/144/6/1719341105667b10312bd98_waiting.jpg",
    detail: {
      lead:
        "Servicing is the one bill drivers most often put off, usually because it is never clear what the money buys. There are only really three levels, and the right one depends on your mileage and your handbook - not on how long it has been since anyone last mentioned it.",
      sections: [
        {
          heading: "Interim service - roughly every 6,000 miles",
          body: [
            "Engine oil and oil filter, then a visual inspection of the items that wear fastest: tyres, brake pads and discs, lights, wipers, and all fluid levels topped up.",
            "It is the short one. If you do a lot of short, cold journeys around Kent rather than motorway miles, an interim between full services is money well spent - oil degrades by time and heat cycles, not just distance.",
          ],
        },
        {
          heading: "Full service - roughly every 12,000 miles or annually",
          body: [
            "Everything in the interim, plus the air filter, fuel filter, spark plugs where they are due, brake fluid and coolant checks, suspension and steering inspection, and a road test.",
            "This is the one that keeps a manufacturer warranty and a full service history intact. Skipping it is the single fastest way to knock money off what your car is worth when you come to sell it.",
          ],
        },
        {
          heading: "An MOT is not a service",
          body: [
            "An MOT is a legal roadworthiness test at one moment in time. It does not change your oil, and it does not tell you a part is close to failing - only that it has not failed yet.",
            "Booking the two together saves you a trip and lets us sort anything the test flags while the car is already with us.",
          ],
        },
        {
          heading: "What it costs here",
          body: [
            "Fixed prices, quoted before we start. Interim from £149, full from £229, MOT £54.85. Manufacturer-trained technicians and genuine parts on Suzuki, KGM and Mitsubishi.",
            "If we find something beyond the service schedule, we ring you with the price and you decide. We do not carry out extra work without your say-so, and we will tell you if something can safely wait until next time.",
          ],
        },
      ],
      checklist: {
        heading: "Before you book, have these to hand",
        items: [
          "Your registration and current mileage",
          "Your service book or digital service record, if you have it",
          "Anything you have noticed - a noise, a warning light, a pull to one side",
          "Your MOT expiry date, so we can line the two up",
        ],
      },
      cta: {
        label: "Book a service",
        href: "#contact",
        note: "Or call the service desk on 01732 870711, Mon-Fri 8:00-18:00.",
      },
    },
  },
  {
    id: "mot-advisories-explained",
    category: "MOT",
    title: "Your MOT advisories, explained in plain English",
    date: "Updated June 2026",
    readTime: "5 min read",
    excerpt:
      "A pass with advisories is still a pass. But some advisories are a warning you have months to act on, and others mean book it in now - here is how to tell them apart.",
    image:
      "https://images.67degreescdn.co.uk/OxvrVgI7NLjSg9hGumadDgUC4eM=/459x500/smart/144/6/1738080472679900d86a1f5_p1123308-edit.jpg",
    detail: {
      lead:
        "Every MOT certificate uses the same four words, and the difference between them matters a great deal - both to your wallet and to whether you are legally allowed to drive away.",
      sections: [
        {
          heading: "The four outcomes",
          body: [
            "Dangerous - a direct and immediate risk to road safety. The car must not be driven until it is repaired, whether or not the old certificate is still valid.",
            "Major - a fail. It must be repaired and the car re-tested before it can go back on the road.",
            "Minor - a pass, but something has begun to go wrong. Get it seen to soon rather than at the next test.",
            "Advisory - a pass with a note that an item is wearing and will need attention in the future. Nothing to do today, but worth diarising.",
          ],
        },
        {
          heading: "The advisories we see most often",
          body: [
            "\"Tyre worn close to the legal limit\" - the limit is 1.6mm across the central three-quarters. At 2mm you have perhaps a few thousand miles left, and wet braking is already noticeably worse. Plan the replacement rather than waiting for the next test.",
            "\"Brake pad wearing thin\" - usually months of normal driving left, but once pads are through to the backing they start cutting into the disc, which turns a modest bill into a much larger one. This is the advisory most worth acting on early.",
            "\"Slight oil leak\" - common on older cars and often a perished seal costing very little. Left alone, oil softens rubber bushes and hoses around it, so the cheap job becomes several jobs.",
            "\"Corrosion, not excessive\" - noted on the underside and subframe. Not a problem this year; on a car you intend to keep, it is worth asking about underbody protection.",
          ],
        },
        {
          heading: "What you are not obliged to do",
          body: [
            "You do not have to have advisory work done where the car was tested, and you do not have to have it done at all to drive legally. Anyone telling you otherwise is selling, not advising.",
            "What we will do is show you the worn part, explain roughly how long you have, and give you a price with no pressure to book it there and then.",
          ],
        },
      ],
      checklist: {
        heading: "Easy pre-test checks that prevent a needless fail",
        items: [
          "Top up the screen wash - an empty bottle is a straight fail",
          "Check every bulb, including number plate and reverse lights",
          "Replace wiper blades that smear or judder",
          "Make sure the number plate is clean, unobscured and the correct font",
          "Clear the warning lights - an illuminated airbag or ABS light fails",
        ],
      },
      cta: {
        label: "Book an MOT",
        href: "#contact",
        note: "£54.85, and we will talk you through the certificate line by line.",
      },
    },
  },
  {
    id: "what-your-warranty-covers",
    category: "Aftercare",
    title: "What your warranty covers - and what it doesn't",
    date: "Updated May 2026",
    readTime: "4 min read",
    excerpt:
      "Warranties cover parts that fail, not parts that wear out. Knowing which is which before you ring up saves a frustrating conversation.",
    image:
      "https://images.67degreescdn.co.uk/9C9qPWP7uR_qH56rdN03cOyRz6w=/459x/144/6/f6302b9b2fd4c2e931e0_21782_10_year_web-banners-v1-1920x873px.jpg",
    detail: {
      lead:
        "Almost every warranty dispute comes down to one distinction: a component that failed when it should not have, versus a component that did exactly what it was always going to do and wore out. The first is covered. The second never is, on any warranty, anywhere.",
      sections: [
        {
          heading: "Covered: mechanical and electrical failure",
          body: [
            "Engine, gearbox, clutch (where it has failed rather than worn), drivetrain, steering, suspension components, braking system hardware, electrics, air conditioning and the electronics behind them.",
            "Parts and labour both, carried out by a qualified technician, with no contribution from you on a manufacturer warranty.",
          ],
        },
        {
          heading: "Not covered: service and wear items",
          body: [
            "Oil, filters, brake pads and discs, tyres, wiper blades, bulbs, the 12-volt battery and clutch friction material. These are consumables - replacing them is servicing, not a warranty claim.",
            "Also excluded: accident and kerb damage, corrosion from unrepaired stone chips, anything caused by modification, and damage from missed or badly documented servicing.",
          ],
        },
        {
          heading: "What you have to do to keep it",
          body: [
            "Service it on schedule, to the manufacturer's specification, and keep the evidence. You are free to use an independent garage - a main dealer is not required - but the work must be right and the record must be complete.",
            "Report a fault promptly. Carrying on driving with a warning light lit can turn a covered failure into an uncovered consequence, and that is a genuinely common reason for a refused claim.",
          ],
        },
        {
          heading: "What we provide",
          body: [
            "Every used car leaves us with a minimum six months' warranty and six months' MOT, after a 120-point inspection. New Suzuki, KGM and Mitsubishi come with the full manufacturer cover, which we can extend at the end of its term.",
            "We are an authorised service agent for all three marques, so warranty work is carried out here rather than sent elsewhere - you deal with the same people who sold you the car.",
          ],
        },
      ],
      checklist: {
        heading: "Keep these safe and a claim is straightforward",
        items: [
          "Your warranty documents and start date",
          "Every service invoice, including independent garage work",
          "Your MOT certificates",
          "A note of when you first noticed a fault, and when you reported it",
        ],
      },
      cta: {
        label: "Ask about your warranty",
        href: "tel:01732870711",
        note: "Have your registration ready and we can look the cover up while you are on the phone.",
      },
    },
  },
  {
    id: "pcp-hp-or-cash",
    category: "Finance",
    title: "PCP, HP or cash: which one actually suits you",
    date: "Updated August 2026",
    readTime: "6 min read",
    excerpt:
      "The cheapest monthly payment and the cheapest car are rarely the same thing. A plain comparison of the three ways to pay, with the catches named.",
    image:
      "https://images.67degreescdn.co.uk/TFK7QKvuB5vSgQ8a4JwwCH48hzA=/459x/144/6/0e11e749a4f9f7b8c0d0_q2-2026-uk-swift_web_banner_1920x873px_v2.jpg",
    detail: {
      lead:
        "There is no best option here, only the one that fits how long you keep cars and how many miles you do. What follows is the honest trade-off in each, including the part that tends not to get mentioned until signing.",
      sections: [
        {
          heading: "PCP - lowest monthly payment, a decision at the end",
          body: [
            "You defer a large chunk of the car's value - the guaranteed future value - to a final balloon payment, and pay interest on the whole amount in the meantime. That is what makes the monthly figure low.",
            "At the end you hand it back and owe nothing further, pay the balloon and keep it, or use any equity above the balloon as deposit on the next one. Three genuine choices, which is the real appeal.",
            "The catches: an annual mileage limit with a pence-per-mile charge if you exceed it, and a fair-wear-and-tear standard on return that does not forgive kerbed alloys or a scuffed bumper. Set the mileage honestly at the start - it is far cheaper than the excess charge.",
          ],
        },
        {
          heading: "HP - higher monthly payment, you own it outright",
          body: [
            "The full price spread across the term. Make the last payment and the car is yours, with no balloon, no mileage limit and no return condition to meet.",
            "It costs more per month than PCP on the same car, and usually less in total interest. If you keep cars for years and do big or unpredictable mileage, it is normally the better deal.",
          ],
        },
        {
          heading: "Cash - cheapest overall, but count what you give up",
          body: [
            "No interest and no agreement, so it is the lowest total cost in nearly every case.",
            "Worth weighing against what that money would otherwise earn, and against keeping a cash buffer. A 0% or low-rate manufacturer offer can make finance the rational choice even when you could pay outright - so ask what the representative APR is before assuming.",
          ],
        },
        {
          heading: "How to compare two quotes properly",
          body: [
            "Ignore the monthly payment and look at the total amount payable - deposit, every payment, the balloon and all fees added together. That is the real price of the car.",
            "Then check the APR, the term, the mileage allowance and any arrangement or option-to-purchase fee. Two deals with the same monthly figure can differ by thousands once those are in view.",
          ],
        },
      ],
      checklist: {
        heading: "Bring these and we can quote properly in one visit",
        items: [
          "Your realistic annual mileage - not your optimistic one",
          "How long you expect to keep the car",
          "Your deposit, and your part-exchange registration if you have one",
          "Three years of address history and employment details for the application",
          "Details of any outstanding finance on your current car",
        ],
      },
      cta: {
        label: "Talk to us about finance",
        href: "#contact",
        note: "Finance is subject to status and affordability. Representative examples are available on request.",
      },
    },
  },
  {
    id: "best-part-exchange-price",
    category: "Part-exchange",
    title: "How to get the most for your part-exchange",
    date: "Updated August 2026",
    readTime: "4 min read",
    excerpt:
      "An afternoon of preparation and the right paperwork routinely moves a valuation by a few hundred pounds. Here is where that money actually comes from.",
    image:
      "https://images.67degreescdn.co.uk/hBhV9Gbp44dEsw52VTga7T9Pjrw=/459x/144/6/9c10a56552d3b2795a73_q2-2026-uk-s-cross_web-1920x873px_v2.jpg",
    detail: {
      lead:
        "A valuation starts from the trade guides for your make, model, age and mileage - then moves up or down on condition, history and how easily the car will sell on. Only the last three are within your control, and they are worth more than most people expect.",
      sections: [
        {
          heading: "History is worth more than polish",
          body: [
            "A complete, stamped service history is the single biggest swing factor on an older car. If services were done at independent garages, dig out the invoices - they count, but only if you can produce them.",
            "Find the V5C logbook, both keys, the locking wheel nut, the handbook and any spare parts that came with the car. A missing second key alone can cost a couple of hundred pounds, because replacing and coding one is not cheap.",
          ],
        },
        {
          heading: "Fix the cheap things, leave the expensive ones",
          body: [
            "Worth doing: a proper clean inside and out, emptying it completely, replacing a blown bulb or a smeared wiper, topping up fluids, and having a smoke or pet smell dealt with professionally.",
            "Not worth doing: new tyres, bodywork repairs or a fresh MOT just before you trade in. We can do that work at trade cost, so paying retail for it first means you lose money on the transaction.",
          ],
        },
        {
          heading: "Outstanding finance is not a problem",
          body: [
            "Most part-exchanges have finance on them. Ring your lender for a settlement figure - valid for a set number of days - and bring it with you.",
            "If the car is worth more than the settlement, the difference becomes deposit on your next car. If it is worth less, that shortfall can usually be carried into the new agreement. We settle with the lender directly either way, so you are not chasing it.",
          ],
        },
        {
          heading: "Be straight about the faults",
          body: [
            "Declare the warning light, the crunchy second gear, the scratch down the wing. We will find all of it during inspection, and a valuation that has to be revised on the day wastes everybody's afternoon.",
            "A known fault, priced in up front, almost always costs you less than the discount applied to a surprise.",
          ],
        },
      ],
      checklist: {
        heading: "Bring these to your valuation",
        items: [
          "V5C logbook in your name, at your current address",
          "Both keys, plus the locking wheel nut key",
          "Full service history and any independent garage invoices",
          "Current MOT certificate",
          "A finance settlement figure, if there is finance outstanding",
          "Photo ID and proof of address",
        ],
      },
      cta: {
        label: "Get a free valuation",
        href: "/website/valuation",
        note: "No obligation, and we will buy your car whether or not you buy one from us.",
      },
    },
  },
  {
    id: "motability-step-by-step",
    category: "Motability",
    title: "Motability, from application to collecting the keys",
    date: "Updated July 2026",
    readTime: "5 min read",
    excerpt:
      "What the Scheme includes, who qualifies, and how long it really takes - set out in order, without the jargon.",
    image:
      "https://images.67degreescdn.co.uk/8frG0OWBndXZg4XkXeCTxoZDnqQ=/479x479/smart/144/6/17041871276593d4f70761f_h-p-homepage-second-image.jpeg",
    detail: {
      lead:
        "The Motability Scheme exchanges your mobility allowance for a brand-new car on a three-year lease, with insurance, servicing, tyres and breakdown cover all included. It is simpler than it sounds, and you do not need to understand any of it before you come in - that is what our specialists are for.",
      sections: [
        {
          heading: "Who can apply",
          body: [
            "Anyone receiving the higher rate mobility component of PIP, DLA, Adult or Child Disability Payment, Armed Forces Independence Payment or War Pensioners' Mobility Supplement, with at least 12 months of the award left to run.",
            "The car does not have to be driven by you. You can name up to two other drivers, and a parent can apply on behalf of a child from the age of three.",
          ],
        },
        {
          heading: "What is included in the payment",
          body: [
            "Insurance for you and your named drivers, servicing and routine maintenance, tyre and windscreen repair or replacement, breakdown cover, and road tax.",
            "You pay for fuel or charging, and for anything outside fair wear and tear. There is no separate insurance to arrange and no MOT to budget for - a new car will not need one during a three-year lease.",
          ],
        },
        {
          heading: "How it runs, step by step",
          body: [
            "One: come in and talk it through. Five of our staff are dedicated Motability specialists, and there is no charge and no commitment for a conversation.",
            "Two: choose the car. Available across the Suzuki and Mitsubishi ranges, including the electric e-Vitara. Some cars need no advance payment at all; others ask for a one-off contribution at the start.",
            "Three: arrange adaptations if you need them. Hand controls, a left-foot accelerator, steering aids, swivel seats and hoists are fitted before you collect, and many common adaptations are at no cost.",
            "Four: we submit the application and Motability confirms your eligibility - usually within a few days. Delivery then depends on the model; some are in stock, others are factory orders of a few months.",
            "Five: collect the car. We set it up with you, walk you through the controls and any adaptations, and you drive away. Your allowance transfers to Motability automatically.",
          ],
        },
        {
          heading: "At the end of three years",
          body: [
            "Hand it back and choose a new one, or hand it back and leave the Scheme - there is no balloon payment and nothing owed, provided the car is within the agreed mileage and fair condition.",
            "Good News Payments may be available at the end of the lease, depending on the car and the condition it comes back in.",
          ],
        },
      ],
      checklist: {
        heading: "Bring these to your appointment",
        items: [
          "Your allowance award letter showing the rate and the end date",
          "Driving licences for yourself and any named drivers",
          "Your National Insurance number",
          "A note of any adaptations you currently use or think you may need",
          "A rough idea of your annual mileage",
        ],
      },
      cta: {
        label: "Speak to a Motability specialist",
        href: "tel:01732870711",
        note: "From £299 per month. Ask for the Motability team - they will book you a proper appointment rather than rush it.",
      },
    },
  },
  {
    id: "is-an-ev-right-for-you",
    category: "Electric",
    title: "Is an electric car right for the way you actually drive?",
    date: "Updated September 2026",
    readTime: "6 min read",
    excerpt:
      "Charging at home changes the sums completely. Charging only in public changes them back again. Work out which you are before you shop.",
    image:
      "https://images.67degreescdn.co.uk/afZfv58mznDRosA8FiLaIkM49fY=/459x/144/6/c8c7152a46ab73307016_q2-2026-uk-e-vitara_web-banner_1920x873px.jpg",
    detail: {
      lead:
        "Electric cars are substantially cheaper to run than petrol for some drivers and roughly the same for others, and the deciding factor is almost always one question: can you charge where you park overnight?",
      sections: [
        {
          heading: "The question that settles it",
          body: [
            "With a home charger on an off-peak overnight tariff, electricity costs a fraction of petrol per mile - the saving is large and it is reliable.",
            "Relying on public rapid chargers, you pay several times the overnight home rate. Against an efficient petrol car the running-cost advantage largely disappears, and you spend time planning stops as well.",
            "So: off-street parking and a charger is the strong case for electric. On-street parking with no charger is the weak one, whatever the brochure says.",
          ],
        },
        {
          heading: "Range, honestly",
          body: [
            "Expect meaningfully less than the official WLTP figure in cold weather - a cold battery and the cabin heater both take their share. A realistic winter figure is roughly three-quarters of the quoted range.",
            "What matters is not the maximum but your normal day. The average UK car covers well under 30 miles a day, which almost any current electric car handles for a week on one charge.",
            "For long trips, the useful number is not range but 10-80% rapid-charge time. Most modern electric cars do that in around half an hour, which is roughly a coffee and a leg stretch.",
          ],
        },
        {
          heading: "The other running costs",
          body: [
            "Servicing is simpler - no oil, no spark plugs, no exhaust, and brake pads last longer because regenerative braking does much of the work. Tyres tend to wear faster, because the cars are heavier.",
            "Electric cars now pay vehicle excise duty like everything else, and the expensive-car supplement applies above the threshold, so factor that in rather than assuming it is free.",
            "The traction battery carries its own long warranty - typically eight years - separate from the rest of the car.",
          ],
        },
        {
          heading: "Who should probably wait",
          body: [
            "If you tow regularly, regularly cover very long distances at speed, or have nowhere to charge at home or at work, a hybrid is likely the better answer for now.",
            "There is no shame in that conclusion and we will tell you so. We would rather you came back in three years than bought the wrong car this year.",
          ],
        },
      ],
      checklist: {
        heading: "Work these out before you test drive",
        items: [
          "Where the car will be parked overnight, and whether a charger can reach it",
          "Your longest regular journey, and whether it is a round trip",
          "Your current spend on fuel per month, as the figure to beat",
          "Whether your electricity tariff has an off-peak overnight rate",
          "Whether you can charge at work",
        ],
      },
      cta: {
        label: "Book an electric test drive",
        href: "#contact",
        note: "Take an e-Vitara out for a proper drive - bring your usual route rather than ours.",
      },
    },
  },
  {
    id: "booking-your-car-in",
    category: "Your visit",
    title: "Booking your car in: courtesy cars, collection and waiting",
    date: "Updated June 2026",
    readTime: "3 min read",
    excerpt:
      "You do not have to lose a day to a service. Four ways to get the work done around your week, and what each one needs from you.",
    image:
      "https://images.67degreescdn.co.uk/8QHJkgmgqtb6EdFT9LB1ikUEyrE=/459x344/smart/144/6/e22777638e3434566d52_humphries---parks-blog-.jpg",
    detail: {
      lead:
        "Most people assume a service means dropping the car off at eight and hoping for a call by five. It does not have to. Tell us which of these suits you when you book and we will plan the day around it.",
      sections: [
        {
          heading: "Wait while we work",
          body: [
            "An MOT or an interim service is usually a while-you-wait job if you book an early slot. There is a customer lounge with wi-fi, proper coffee and somewhere to work, and West Malling station and the high street are a short walk away.",
            "Worth asking for if your job is short. Ask when you book rather than on the day - the early slots go first.",
          ],
        },
        {
          heading: "Borrow a courtesy car",
          body: [
            "Free, subject to availability, and the thing most worth booking ahead - they are usually committed days in advance.",
            "You will need to be 25 or over with a full licence held at least 12 months, bring your licence and a proof of address, and return it with the same amount of fuel in it.",
          ],
        },
        {
          heading: "Let us collect and deliver",
          body: [
            "We will pick the car up from your home or work within the local area and bring it back when it is done. You need to be there to hand over the keys, and there is a short form to sign.",
            "The simplest option if you cannot get to us at all during opening hours.",
          ],
        },
        {
          heading: "Leave it with us overnight",
          body: [
            "Drop it off the evening before and collect after work. Useful for bigger jobs, and for anything where we may need to order a part in.",
            "Whichever you choose, we ring you with a price before carrying out any work beyond what you booked - and we send a video of anything we have found, so you can see it rather than take our word for it.",
          ],
        },
      ],
      checklist: {
        heading: "Service department opening hours",
        items: [
          "Monday to Friday, 8:00 - 18:00",
          "Saturday, 8:30 - 12:30",
          "Sunday, closed",
          "120 London Road, West Malling, Kent ME19 5AN",
        ],
      },
      cta: {
        label: "Book your car in",
        href: "#contact",
        note: "Call 01732 870711 and say which of the four options you would like.",
      },
    },
  },
];
