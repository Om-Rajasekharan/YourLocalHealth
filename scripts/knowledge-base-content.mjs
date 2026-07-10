// Curated public-health reference snippets for the AI assistant's RAG
// knowledge base. General, non-personalized education only -- no diagnosis,
// no dosing, no treatment instructions. Kept separate from the seeding
// script so the content can be reviewed/edited without touching embedding
// logic.

export const knowledgeBaseEntries = [
  {
    topic: "Air Quality Index (AQI)",
    source: "U.S. EPA -- Air Quality Index guidance",
    content:
      "The Air Quality Index (AQI) is a standardized 0-500 scale used by U.S. environmental agencies to communicate how polluted outdoor air is and what health effects might be expected. Higher values mean greater health concern: 0-50 is Good, 51-100 Moderate, 101-150 Unhealthy for Sensitive Groups, 151-200 Unhealthy, 201-300 Very Unhealthy, and 301+ Hazardous. Sensitive groups (people with asthma, other lung disease, heart disease, older adults, children, and pregnant people) are advised to reduce prolonged or heavy outdoor exertion at lower AQI thresholds than the general public.",
  },
  {
    topic: "PM2.5 fine particulate matter",
    source: "U.S. EPA -- Particulate Matter (PM) Basics",
    content:
      "PM2.5 refers to fine inhalable particles with diameters generally 2.5 micrometers or smaller -- small enough to travel deep into the lungs and, for some particles, into the bloodstream. Common sources include vehicle exhaust, wildfire smoke, and industrial emissions. Short-term exposure is associated with eye, nose, and throat irritation and can aggravate asthma or heart conditions; long-term exposure is associated with reduced lung function over time. Staying indoors with windows closed, using a HEPA air filter, and avoiding heavy outdoor exertion are common ways to reduce exposure during elevated PM2.5 periods.",
  },
  {
    topic: "Ground-level ozone",
    source: "U.S. EPA -- Ground-level Ozone Basics",
    content:
      "Ground-level ozone forms when pollutants from vehicles, industry, and other sources react chemically in sunlight, and it tends to peak on hot, sunny afternoons. Breathing elevated ozone can trigger coughing, throat irritation, chest tightness, and worsened asthma symptoms, particularly during outdoor exertion. Ozone levels are typically lower in the early morning and evening, so shifting outdoor activity to those windows is a common way to reduce exposure on high-ozone days.",
  },
  {
    topic: "Extreme heat and heat-related illness",
    source: "CDC -- Extreme Heat and Your Health",
    content:
      "Heat-related illness ranges from heat cramps and heat exhaustion to heat stroke, a medical emergency. Warning signs of heat exhaustion include heavy sweating, weakness, cold or clammy skin, and nausea. Heat stroke warning signs include a body temperature above 103F, hot and dry or damp skin, a fast strong pulse, confusion, and losing consciousness -- this requires immediate emergency medical attention. Staying hydrated, limiting strenuous outdoor activity during peak heat, seeking air-conditioned spaces, and checking on infants, older adults, and people with chronic conditions are standard precautions during heat advisories.",
  },
  {
    topic: "UV index and sun exposure",
    source: "CDC / U.S. EPA -- UV Index guidance",
    content:
      "The UV Index is a 0-11+ scale forecasting the strength of ultraviolet radiation at a given time and place; higher numbers mean greater risk of skin and eye damage from unprotected sun exposure, with 8 and above generally considered very high to extreme. UV exposure is typically strongest at midday and can be intensified by reflection off water, sand, or snow. Common protective measures include seeking shade, wearing protective clothing and sunglasses, and using broad-spectrum sunscreen, particularly when the UV Index is 6 or higher.",
  },
  {
    topic: "Seasonal influenza (flu) basics",
    source: "CDC -- Flu Basics",
    content:
      "Seasonal influenza is a contagious respiratory illness caused by influenza viruses, typically circulating more heavily in fall and winter in the United States. Symptoms often include fever, cough, sore throat, body aches, and fatigue, and can range from mild to severe. Flu activity levels reported by public health surveillance describe how much influenza-like illness is being observed in a region relative to typical baselines, which can help contextualize personal risk during a search or exposure window, though they do not predict any individual's outcome.",
  },
  {
    topic: "COVID-19 wastewater surveillance",
    source: "CDC -- Wastewater Surveillance overview",
    content:
      "Wastewater surveillance measures the concentration of SARS-CoV-2 viral genetic material in sewage systems, which can reflect community-level COVID-19 trends -- including from people who never get tested -- often earlier than case reporting. Reported wastewater activity levels (e.g., low, moderate, high) describe relative viral concentration in a sampled area compared to that site's own historical baseline, not an absolute measure of individual infection risk, and data coverage/reporting frequency varies by location.",
  },
  {
    topic: "Pollen and seasonal allergies",
    source: "CDC / AAAAI -- Pollen and Allergies overview",
    content:
      "Seasonal allergic rhinitis (hay fever) is commonly triggered by airborne pollen from trees (typically spring), grasses (typically late spring/summer), and weeds such as ragweed (typically late summer/fall), with exact timing varying by region and year-to-year weather. Common symptoms include sneezing, runny or congested nose, itchy or watery eyes, and throat irritation. Pollen counts tend to be highest in the morning and on dry, windy days, and lower after rain; keeping windows closed and showering after extended outdoor time are common ways to reduce exposure.",
  },
  {
    topic: "Respiratory symptoms -- when to seek care",
    source: "CDC -- general respiratory illness guidance",
    content:
      "Most mild respiratory symptoms (runny nose, mild cough, sore throat) can typically be managed with rest and supportive care. Warning signs that generally warrant prompt medical evaluation include difficulty breathing or shortness of breath, persistent chest pain or pressure, confusion, bluish lips or face, or symptoms that significantly worsen after initially improving. Anyone with severe or rapidly worsening symptoms should seek urgent medical care or call emergency services rather than wait.",
  },
  {
    topic: "Air pollution and vulnerable groups",
    source: "U.S. EPA -- Who's at Greater Risk from Air Pollution",
    content:
      "Certain groups face higher health risk from a given level of air pollution: people with asthma or COPD, people with heart disease, older adults, children (whose lungs are still developing and who breathe more air relative to body size), pregnant people, and people who work or exercise outdoors for extended periods. Public health guidance during elevated pollution often recommends these groups reduce prolonged or heavy outdoor exertion earlier -- i.e., at lower AQI thresholds -- than the general population.",
  },
  {
    topic: "Wildfire smoke exposure",
    source: "CDC / U.S. EPA -- Wildfire Smoke and Your Health",
    content:
      "Wildfire smoke is a mixture of gases and fine particles (largely PM2.5) that can travel long distances from the fire source and significantly elevate local AQI even far from active flames. Short-term exposure can cause eye and respiratory irritation, coughing, and worsened asthma or heart conditions; people with existing lung or heart conditions, older adults, children, and pregnant people are advised to take extra precautions. Staying indoors with windows and doors closed, running air conditioning or purifiers on recirculate, and avoiding activities that add indoor particles (like burning candles) are common recommendations during smoke events.",
  },
  {
    topic: "Chronic disease burden and environmental health equity",
    source: "CDC PLACES -- local health data overview",
    content:
      "Chronic disease prevalence (such as asthma, COPD, diabetes, and obesity rates) varies significantly by community and is influenced by a combination of factors including environmental exposure history, access to healthcare, and socioeconomic conditions. Areas with higher chronic disease burden may see amplified health impacts from the same level of environmental stressor (like air pollution or heat) compared to areas with lower burden, which is part of why public health guidance often emphasizes local context rather than a single national threshold.",
  },
  {
    topic: "Indoor air quality during outdoor pollution events",
    source: "U.S. EPA -- Indoor Air Quality guidance",
    content:
      "During periods of poor outdoor air quality (smoke, high ozone, or high particulate pollution), keeping windows and doors closed and running air conditioning on recirculate mode (rather than pulling in outside air) can meaningfully reduce indoor pollutant levels. Portable HEPA air cleaners sized appropriately for the room can further reduce indoor particulate concentration. Activities that add particles indoors -- smoking, burning candles or incense, frying food -- are best minimized during these periods.",
  },
  {
    topic: "General preventive respiratory hygiene",
    source: "CDC -- respiratory virus prevention basics",
    content:
      "Common measures to reduce transmission of respiratory illnesses (flu, COVID-19, and other respiratory viruses) include frequent handwashing, covering coughs and sneezes, staying home when sick, improving indoor ventilation, and staying current on recommended vaccinations for one's age and health status. These are general population-level prevention measures, not a substitute for individualized medical guidance, especially for people who are immunocompromised or have chronic conditions.",
  },
];
