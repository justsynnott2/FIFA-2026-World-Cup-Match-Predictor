def get_form_last_10(team, date, df, n=10):
    team_matches = df[
        ((df['home_team'] == team) | (df['away_team'] == team)) &
        (df['date'] < date)
    ].sort_values('date').tail(n)

    if len(team_matches) == 0:
        return 0.5

    wins = 0
    for _, row in team_matches.iterrows():
        if row['home_team'] == team:
            if row['result'] == 'home_win':
                wins += 1
            elif row['result'] == 'draw':
                wins += 0.5
        else:
            if row['result'] == 'away_win':
                wins += 1
            elif row['result'] == 'draw':
                wins += 0.5

    return wins / len(team_matches)

def get_goal_avg_last_10(team, date, df, n=10):
    team_matches = df[
        ((df['home_team'] == team) | (df['away_team'] == team)) &
        (df['date'] < date)
    ].sort_values('date').tail(n)

    if len(team_matches) == 0:
        return 0.0, 0.0

    goals_scored = 0
    goals_conceded = 0
    for _, row in team_matches.iterrows():
        if row['home_team'] == team:
            goals_scored += row['home_score']
            goals_conceded += row['away_score']
        else:
            goals_scored += row['away_score']
            goals_conceded += row['home_score']

    return goals_scored / len(team_matches), goals_conceded / len(team_matches)

def head_to_head_last_10(team1, team2, date, df, n=10):
    matches = df[
        ((df['home_team'] == team1) & (df['away_team'] == team2)) |
        ((df['home_team'] == team2) & (df['away_team'] == team1))
    ]
    matches = matches[matches['date'] < date].sort_values('date').tail(n)

    if len(matches) == 0:
        return 0.5, 0.5

    team1_wins = 0
    team2_wins = 0

    for _, row in matches.iterrows():
        if row['home_team'] == team1:
            if row['result'] == 'home_win':
                team1_wins += 1
            elif row['result'] == 'away_win':
                team2_wins += 1
            else:
                team1_wins += 0.5
                team2_wins += 0.5
        else:
            if row['result'] == 'home_win':
                team2_wins += 1
            elif row['result'] == 'away_win':
                team1_wins += 1
            else:
                team1_wins += 0.5
                team2_wins += 0.5

    total = len(matches)
    return team1_wins / total, team2_wins / total

def get_elo_rating(team, date, elo_df, default=1500):
    team_elo = elo_df[
        (elo_df['team'] == team) &
        (elo_df['date'] < date)
    ].sort_values('date')

    if len(team_elo) == 0:
        return default

    return team_elo.iloc[-1]['rating']