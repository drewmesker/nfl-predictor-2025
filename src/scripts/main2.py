import nfl_data_py as nfl
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
import os

# -----------------------------------------------------------
# 1. Load historical play-by-play data (2018-2023)
# -----------------------------------------------------------
print("Loading historical play-by-play data (this may take a while)...")
pbp_hist = nfl.import_pbp_data(range(2018, 2024))

# -----------------------------------------------------------
# 2. Build game-level dataset from play-by-play
# -----------------------------------------------------------
def build_game_level_df(pbp: pd.DataFrame) -> pd.DataFrame:
    df = pbp.copy()
    df["third_down_attempt"] = (df["down"] == 3).astype(int)
    df["fourth_down_attempt"] = (df["down"] == 4).astype(int)
    df["third_down_converted"] = ((df["down"] == 3) & (df["first_down"] == 1)).astype(int)
    df["fourth_down_converted"] = ((df["down"] == 4) & (df["first_down"] == 1)).astype(int)
    df["red_zone_play"] = (df["yardline_100"] <= 20).astype(int)

    cols = [
        "game_id", "season", "week", "posteam", "defteam",
        "pass_attempt", "rush_attempt", "epa", "yards_gained", "touchdown",
        "interception", "fumble_lost", "third_down_converted", "third_down_attempt",
        "fourth_down_converted", "fourth_down_attempt", "red_zone_play"
    ]
    df = df[cols].dropna(subset=["posteam", "defteam"])

    grouped = (
        df.groupby(["game_id", "season", "week", "posteam", "defteam"])
          .agg(
              plays=("epa", "count"),
              total_epa=("epa", "sum"),
              avg_epa=("epa", "mean"),
              yards=("yards_gained", "sum"),
              tds=("touchdown", "sum"),
              passes=("pass_attempt", "sum"),
              rushes=("rush_attempt", "sum"),
              turnovers=("interception", "sum"),
              fumbles=("fumble_lost", "sum"),
              third_down_pct=("third_down_converted", "mean"),
              fourth_down_pct=("fourth_down_converted", "mean"),
              red_zone_plays=("red_zone_play", "sum"),
          )
          .reset_index()
    )
    return grouped

hist_games = build_game_level_df(pbp_hist)
print("Built historical game-level dataset:", hist_games.shape)

# -----------------------------------------------------------
# 3. Merge final scores from historical schedules
# -----------------------------------------------------------
schedule_hist = nfl.import_schedules(range(2018, 2024))
scores = schedule_hist[["game_id", "home_team", "away_team", "home_score", "away_score"]]

home = scores.rename(columns={"home_team":"team","away_team":"opp","home_score":"score"})[["game_id","team","opp","score"]]
away = scores.rename(columns={"away_team":"team","home_team":"opp","away_score":"score"})[["game_id","team","opp","score"]]
scores_long = pd.concat([home, away])

hist_merged = hist_games.merge(scores_long, left_on=["game_id","posteam"], right_on=["game_id","team"])
print("Merged historical data:", hist_merged.shape)

# -----------------------------------------------------------
# 4. Compute rolling team stats (last 2 seasons)
# -----------------------------------------------------------
base_feature_cols = [
    "plays","total_epa","avg_epa","yards","tds","passes","rushes",
    "turnovers","fumbles","third_down_pct","fourth_down_pct","red_zone_plays"
]

def compute_rolling_team_stats(df: pd.DataFrame, n_seasons=2):
    df = df.copy()
    df = df.sort_values(["team","season","week"])
    rolling_features = []

    for team in df["team"].unique():
        team_df = df[df["team"] == team].copy()
        team_df[base_feature_cols] = team_df[base_feature_cols].rolling(window=n_seasons*17, min_periods=1).mean()
        rolling_features.append(team_df)

    return pd.concat(rolling_features)

hist_merged = compute_rolling_team_stats(hist_merged, n_seasons=2)

# -----------------------------------------------------------
# 5. Add opponent-adjusted features dynamically (for training only)
# -----------------------------------------------------------
def add_matchup_adjusted_features(df: pd.DataFrame):
    df = df.copy()
    df_features = []

    for idx, row in df.iterrows():
        team_stats = row[base_feature_cols].copy()
        opp_stats = df[(df['team']==row['opp']) & (df['season']<row['season'])].groupby('team')[base_feature_cols].mean()
        if not opp_stats.empty:
            team_stats_vs_opp = team_stats - opp_stats.iloc[-1]
        else:
            team_stats_vs_opp = team_stats - df[base_feature_cols].mean()

        for col in base_feature_cols:
            row[f"{col}_vs_opp"] = team_stats_vs_opp[col]
        df_features.append(row)

    return pd.DataFrame(df_features)

hist_merged = add_matchup_adjusted_features(hist_merged)
feature_cols = base_feature_cols + [f"{col}_vs_opp" for col in base_feature_cols]

# -----------------------------------------------------------
# 6. Prepare training data
# -----------------------------------------------------------
X = hist_merged[feature_cols].fillna(0)
y = hist_merged["score"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestRegressor(n_estimators=300, random_state=42)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
print("Validation MAE:", mean_absolute_error(y_test, y_pred))

# -----------------------------------------------------------
# 7. Load 2025 schedule
# -----------------------------------------------------------
schedule_2025 = nfl.import_schedules([2025])
print("2025 schedule rows:", schedule_2025.shape[0])

# -----------------------------------------------------------
# 8. Compute recent team baselines (2023–2024)
# -----------------------------------------------------------
pbp_2023_2024 = nfl.import_pbp_data([2023, 2024])
games_recent = build_game_level_df(pbp_2023_2024)

scores_recent = nfl.import_schedules([2023, 2024])[["game_id","home_team","away_team","home_score","away_score"]]
home_recent = scores_recent.rename(columns={"home_team":"team","away_team":"opp","home_score":"score"})[["game_id","team","opp","score"]]
away_recent = scores_recent.rename(columns={"away_team":"team","home_team":"opp","away_score":"score"})[["game_id","team","opp","score"]]
scores_long_recent = pd.concat([home_recent, away_recent])
games_recent = games_recent.merge(scores_long_recent, left_on=["game_id","posteam"], right_on=["game_id","team"])

team_baselines = games_recent.groupby("team")[base_feature_cols].mean().reset_index()
team_baselines = team_baselines.set_index("team")

# Compute most common scores per team
team_common_scores = hist_merged.groupby("team")["score"].agg(lambda x: x.value_counts().idxmax())

# -----------------------------------------------------------
# 9. Make predictions for 2025 with common-score adjustment
# -----------------------------------------------------------
HOME_FIELD_ADV = 2.5

def make_prediction_df(schedule: pd.DataFrame, blend_common=0.3, add_points=3) -> pd.DataFrame:
    preds = []
    for _, row in schedule.iterrows():
        home_team, away_team = row["home_team"], row["away_team"]
        for team, opp, is_home in [(home_team, away_team, True), (away_team, home_team, False)]:
            entry = {"game_id": row["game_id"], "team": team, "opp": opp, "is_home": is_home}
            
            # Base feature assignment
            if team in team_baselines.index:
                for col in base_feature_cols:
                    baseline = team_baselines.loc[team, col]
                    opp_adj = team_baselines.loc[opp, col] if opp in team_baselines.index else 0
                    entry[col] = baseline - opp_adj
            else:
                for col in base_feature_cols:
                    entry[col] = games_recent[col].mean()

            # Home field advantage
            if is_home:
                entry["total_epa"] += HOME_FIELD_ADV

            for col in base_feature_cols:
                entry[f"{col}_vs_opp"] = 0

            preds.append(entry)
    
    df_pred = pd.DataFrame(preds)
    
    # Model prediction
    df_pred["predicted_score"] = model.predict(df_pred[feature_cols])
    
    # Blend toward most common historical score
    def blend_common_score(team, score):
        if team in team_common_scores:
            common = team_common_scores[team]
            score = score * (1 - blend_common) + common * blend_common
        # Add fixed points
        score += add_points
        # Round to realistic NFL scoring clusters
        # Round to nearest 3 or 7
        multiples = np.array([3, 7])
        score = multiples[np.abs(multiples - (score % 10)).argmin()] + 10 * (score // 10)
        return score
    
    df_pred["predicted_score"] = [
        blend_common_score(team, score) for team, score in zip(df_pred["team"], df_pred["predicted_score"])
    ]
    
    return df_pred

pred_input = make_prediction_df(schedule_2025)

# -----------------------------------------------------------
# 10. Pivot back to game-level predictions
# -----------------------------------------------------------
home_preds = pred_input[pred_input["is_home"]].rename(columns={"team":"home_team","predicted_score":"home_pred_score"})
away_preds = pred_input[~pred_input["is_home"]].rename(columns={"team":"away_team","predicted_score":"away_pred_score"})

final_preds = home_preds[["game_id","home_team","home_pred_score"]].merge(
    away_preds[["game_id","away_team","away_pred_score"]], on="game_id"
)

final_preds["projected_winner"] = np.where(final_preds["home_pred_score"] > final_preds["away_pred_score"],
                                           final_preds["home_team"], final_preds["away_team"])

# -----------------------------------------------------------
# 11. Merge odds, spreads, metadata, and actual results
# -----------------------------------------------------------
odds_cols = [
    "game_id", "week", "gameday", "gametime", "stadium", "location", "roof", "surface", "temp", "wind",
    "away_moneyline", "home_moneyline", "spread_line", "away_spread_odds", "home_spread_odds",
    "total_line", "under_odds", "over_odds", "away_qb_name", "home_qb_name", "away_coach", "home_coach"
]

schedule_meta = schedule_2025[odds_cols]

final_preds = final_preds.merge(
    schedule_meta, on="game_id", how="left"
).merge(
    schedule_2025[["game_id","home_score","away_score"]],
    on="game_id",
    how="left"
)

final_preds["predicted_winner_correct"] = final_preds["projected_winner"] == np.where(
    final_preds["home_score"] > final_preds["away_score"], final_preds["home_team"], final_preds["away_team"]
)

# -----------------------------------------------------------
# 12. Save JSON for React
# -----------------------------------------------------------
os.makedirs("./nfl-predictor/public", exist_ok=True)
final_preds.to_json("./nfl-predictor/public/nfl_2025_predictions.json", orient="records", indent=4)

print("\n2025 Predictions saved to ./nfl-predictor/public/nfl_2025_predictions.json")
