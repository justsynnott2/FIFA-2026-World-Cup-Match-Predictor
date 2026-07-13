import joblib
import pandas as pd
import os

# Loads the trained model/encoders and historical match data at import time,
# and builds the static lookup tables (confederation_map, tournament_weights)
# predict.py's feature engineering depends on. Everything here runs once on
# module import, not per-request.

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')

model = joblib.load(os.path.join(MODELS_DIR, 'model.pkl'))

competitive = pd.read_csv(os.path.join(MODELS_DIR, 'competitive.csv'))
elo_ratings_df = pd.read_csv(os.path.join(MODELS_DIR, 'elo_ratings.csv'))

home_confederation_le = joblib.load(os.path.join(MODELS_DIR, 'home_confederation_le.pkl'))
away_confederation_le = joblib.load(os.path.join(MODELS_DIR, 'away_confederation_le.pkl'))

# Convert dates
competitive['date'] = pd.to_datetime(competitive['date'])
elo_ratings_df['date'] = pd.to_datetime(elo_ratings_df['date'], format='mixed')

# Mirror neutral matches to remove home/away bias.
# For historical matches played at a neutral site, which side was recorded as
# "home" vs "away" is arbitrary, but the model still has home/away-shaped
# features (home_form, away_form, etc.). Duplicating each neutral match with
# the sides swapped (and the result flipped to match) is training-data
# augmentation that cancels out any spurious home/away pattern the model would
# otherwise learn from neutral fixtures — the same swap-and-average idea
# predict_match applies at inference time for non-host matchups.
def flip_result(result):
    if result == 'home_win':
        return 'away_win'
    elif result == 'away_win':
        return 'home_win'
    return 'draw'

neutral_matches = competitive[competitive['neutral'] == True].copy()
swapped = neutral_matches.copy()
swapped['home_team'] = neutral_matches['away_team']
swapped['away_team'] = neutral_matches['home_team']
swapped['home_score'] = neutral_matches['away_score']
swapped['away_score'] = neutral_matches['home_score']
swapped['result'] = swapped['result'].apply(flip_result)

competitive = pd.concat([competitive, swapped]).sort_values('date').reset_index(drop=True)

confederation_map = {
    #UEFA
    'Albania': 'UEFA', 'Andorra': 'UEFA', 'Armenia': 'UEFA', 'Austria': 'UEFA',
    'Azerbaijan': 'UEFA', 'Belarus': 'UEFA', 'Belgium': 'UEFA', 'Bosnia and Herzegovina': 'UEFA',
    'Bulgaria': 'UEFA', 'CIS': 'UEFA', 'Croatia': 'UEFA', 'Cyprus': 'UEFA', 'Czechia': 'UEFA',
    'Czechoslovakia': 'UEFA', 'Czech Republic': 'UEFA', 'Denmark': 'UEFA', 'East Germany': 'UEFA',
    'England': 'UEFA', 'Estonia': 'UEFA', 'Faroe Islands': 'UEFA', 'Finland': 'UEFA',
    'FR Yugoslavia': 'UEFA', 'France': 'UEFA', 'Georgia': 'UEFA', 'German DR': 'UEFA', 'Germany': 'UEFA',
    'Gibraltar': 'UEFA', 'Greece': 'UEFA', 'Hungary': 'UEFA', 'Iceland': 'UEFA', 'Ireland': 'UEFA',
    'Israel': 'UEFA', 'Italy': 'UEFA', 'Kazakhstan': 'UEFA', 'Kosovo': 'UEFA', 'Latvia': 'UEFA',
    'Liechtenstein': 'UEFA', 'Lithuania': 'UEFA', 'Luxembourg': 'UEFA', 'Malta': 'UEFA', 'Moldova': 'UEFA',
    'Montenegro': 'UEFA', 'Netherlands': 'UEFA', 'North Macedonia': 'UEFA', 'Northern Ireland': 'UEFA',
    'Norway': 'UEFA', 'Poland': 'UEFA', 'Portugal': 'UEFA', 'Republic of Ireland': 'UEFA', 'Romania': 'UEFA',
    'Russia': 'UEFA', 'Saarland': 'UEFA', 'San Marino': 'UEFA', 'Scotland': 'UEFA', 'Serbia': 'UEFA', 
    'Serbia and Montenegro': 'UEFA', 'Slovakia': 'UEFA', 'Slovenia': 'UEFA', 'Soviet Union': 'UEFA',
    'Spain': 'UEFA', 'Sweden': 'UEFA', 'Switzerland': 'UEFA', 'Turkey': 'UEFA', 'Ukraine': 'UEFA',
    'Wales': 'UEFA', 'Yugoslavia': 'UEFA',

    #CONMEBOL
    'Argentina': 'CONMEBOL', 'Bolivia': 'CONMEBOL', 'Brazil': 'CONMEBOL', 'Chile': 'CONMEBOL',
    'Colombia': 'CONMEBOL', 'Ecuador': 'CONMEBOL', 'Paraguay': 'CONMEBOL', 'Peru': 'CONMEBOL',
    'Uruguay': 'CONMEBOL', 'Venezuela': 'CONMEBOL',

    #CONCACAF
    'Anguilla': 'CONCACAF', 'Antigua and Barbuda': 'CONCACAF', 'Aruba': 'CONCACAF',
    'Bahamas': 'CONCACAF', 'Barbados': 'CONCACAF', 'Belize': 'CONCACAF',
    'Bermuda': 'CONCACAF', 'Bonaire': 'CONCACAF', 'British Virgin Islands': 'CONCACAF',
    'Canada': 'CONCACAF', 'Cayman Islands': 'CONCACAF', 'Costa Rica': 'CONCACAF',
    'Cuba': 'CONCACAF', 'Curaçao': 'CONCACAF', 'Curacao': 'CONCACAF',
    'Dominica': 'CONCACAF', 'Dominican Republic': 'CONCACAF', 'El Salvador': 'CONCACAF',
    'French Guiana': 'CONCACAF', 'Grenada': 'CONCACAF', 'Guadeloupe': 'CONCACAF',
    'Guatemala': 'CONCACAF', 'Guyana': 'CONCACAF', 'Haiti': 'CONCACAF',
    'Honduras': 'CONCACAF', 'Jamaica': 'CONCACAF', 'Martinique': 'CONCACAF',
    'Mexico': 'CONCACAF', 'Montserrat': 'CONCACAF', 'Nicaragua': 'CONCACAF',
    'Panama': 'CONCACAF', 'Puerto Rico': 'CONCACAF', 'Saint Kitts and Nevis': 'CONCACAF',
    'Saint Lucia': 'CONCACAF', 'Saint Martin': 'CONCACAF',
    'Saint Vincent and the Grenadines': 'CONCACAF', 'Sint Maarten': 'CONCACAF',
    'Suriname': 'CONCACAF', 'Trinidad and Tobago': 'CONCACAF',
    'Turks and Caicos Islands': 'CONCACAF', 'United States': 'CONCACAF',
    'United States Virgin Islands': 'CONCACAF', 'U.S. Virgin Islands': 'CONCACAF',

    #CAF
    'Algeria': 'CAF', 'Angola': 'CAF', 'Benin': 'CAF', 'Botswana': 'CAF',
    'Burkina Faso': 'CAF', 'Burundi': 'CAF', 'Cameroon': 'CAF', 'Cape Verde': 'CAF',
    'Central African Republic': 'CAF', 'Chad': 'CAF', 'Comoros': 'CAF', 'Congo': 'CAF',
    'Democratic Republic of Congo': 'CAF', 'Djibouti': 'CAF', 'DR Congo': 'CAF',
    'Egypt': 'CAF', 'Equatorial Guinea': 'CAF', 'Eritrea': 'CAF', 'Eswatini': 'CAF',
    'Ethiopia': 'CAF', 'Gabon': 'CAF', 'Gambia': 'CAF', 'Ghana': 'CAF',
    'Guinea': 'CAF', 'Guinea-Bissau': 'CAF', 'Ivory Coast': 'CAF', 'Kenya': 'CAF',
    'Lesotho': 'CAF', 'Liberia': 'CAF', 'Libya': 'CAF', 'Madagascar': 'CAF',
    'Malawi': 'CAF', 'Mali': 'CAF', 'Mauritania': 'CAF', 'Mauritius': 'CAF',
    'Morocco': 'CAF', 'Mozambique': 'CAF', 'Namibia': 'CAF', 'Niger': 'CAF',
    'Nigeria': 'CAF', 'Réunion': 'CAF', 'Rwanda': 'CAF', 'São Tomé and Príncipe': 'CAF',
    'Senegal': 'CAF', 'Seychelles': 'CAF', 'Sierra Leone': 'CAF', 'Somalia': 'CAF',
    'South Africa': 'CAF', 'South Sudan': 'CAF', 'Sudan': 'CAF', 'Tanzania': 'CAF',
    'Togo': 'CAF', 'Tunisia': 'CAF', 'Uganda': 'CAF', 'Zambia': 'CAF',
    'Zanzibar': 'CAF', 'Zimbabwe': 'CAF',

    #AFC
    'Afghanistan': 'AFC', 'Australia': 'AFC', 'Bahrain': 'AFC', 'Bangladesh': 'AFC',
    'Bhutan': 'AFC', 'Brunei': 'AFC', 'Cambodia': 'AFC', 'China': 'AFC',
    'Chinese Taipei': 'AFC', 'Guam': 'AFC', 'Hong Kong': 'AFC', 'India': 'AFC',
    'Indonesia': 'AFC', 'Iran': 'AFC', 'Iraq': 'AFC', 'Japan': 'AFC',
    'Jordan': 'AFC', 'Kuwait': 'AFC', 'Kyrgyzstan': 'AFC', 'Laos': 'AFC',
    'Lebanon': 'AFC', 'Macau': 'AFC', 'Malaysia': 'AFC', 'Maldives': 'AFC',
    'Mongolia': 'AFC', 'Myanmar': 'AFC', 'Nepal': 'AFC', 'North Korea': 'AFC',
    'Northern Mariana Islands': 'AFC', 'Oman': 'AFC', 'Pakistan': 'AFC',
    'Palestine': 'AFC', 'Philippines': 'AFC', 'Qatar': 'AFC', 'Saudi Arabia': 'AFC',
    'Singapore': 'AFC', 'South Korea': 'AFC', 'Sri Lanka': 'AFC', 'Syria': 'AFC',
    'Taiwan': 'AFC', 'Tajikistan': 'AFC', 'Thailand': 'AFC', 'Timor-Leste': 'AFC',
    'Turkmenistan': 'AFC', 'United Arab Emirates': 'AFC', 'UAE': 'AFC',
    'Uzbekistan': 'AFC', 'Vietnam': 'AFC', 'Yemen': 'AFC',

    #OFC
    'American Samoa': 'OFC', 'Cook Islands': 'OFC', 'Federated States of Micronesia': 'OFC',
    'Fiji': 'OFC', 'Kiribati': 'OFC', 'New Caledonia': 'OFC', 'New Zealand': 'OFC',
    'Niue': 'OFC', 'Palau': 'OFC', 'Papua New Guinea': 'OFC', 'Samoa': 'OFC', 'Solomon Islands': 'OFC',
    'Tahiti': 'OFC', 'Tonga': 'OFC', 'Tuvalu': 'OFC', 'Vanuatu': 'OFC',
}

tournament_weights = {
    'FIFA World Cup': 3.0,
    'FIFA World Cup qualification': 2.0,
    'Copa América': 2.0,
    'UEFA Euro': 2.0,
    'UEFA Euro qualification': 1.5,
    'African Cup of Nations': 1.5,
    'African Cup of Nations qualification': 1.25,
    'UEFA Nations League': 1.5,
    'Confederations Cup': 1.5,
    'Gold Cup': 1.25,
    'AFC Asian Cup': 1.25,
    'CONCACAF Nations League': 1.25,
}