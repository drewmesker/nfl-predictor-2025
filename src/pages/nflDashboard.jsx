import React, { useEffect, useState } from "react";
import * as NFLIcons from "react-nfl-logos";
import {
  Box,
  Card,
  Typography,
  Chip,
  CircularProgress,
  Pagination,
  Modal,
  Button,
  Grid,
} from "@mui/material";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#1976d2", "#ff6d00"];

const PAGE_SIZE = 15;

export default function NflScheduleDashboard() {
  const [games, setGames] = useState([]);
  const [page, setPage] = useState(1);
  const [selectedGame, setSelectedGame] = useState(null);

  useEffect(() => {
    fetch("/nfl_2025_predictions.json")
      .then((res) => res.json())
      .then((data) => setGames(data.sort((a, b) => a.week - b.week)));
  }, []);

  if (!games.length)
    return (
      <Box display="flex" justifyContent="center" mt={10}>
        <CircularProgress />
      </Box>
    );

  // Group by week
  const weeks = {};
  games.forEach((g) => {
    const weekKey = `Week ${g.week}`;
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(g);
  });

  const weekKeys = Object.keys(weeks);
  const startIndex = (page - 1) * PAGE_SIZE;
  const paginatedWeeks = weekKeys.slice(startIndex, startIndex + PAGE_SIZE);
  const totalPages = Math.ceil(weekKeys.length / PAGE_SIZE);

  // Helper to render NFL logos
  const renderLogo = (teamAbbr) => {
    const LogoComponent = NFLIcons[teamAbbr];
    return LogoComponent ? (
      <Box
        sx={{
          width: 40,
          height: 40,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <LogoComponent style={{ maxWidth: "100%", maxHeight: "100%" }} />
      </Box>
    ) : null;
  };

  return (
    <Box maxWidth="900px" mx="auto" p={3}>
      {paginatedWeeks.map((week) => (
        <Box key={week} mb={4}>
          <Typography variant="h5" fontWeight="bold" mb={2} align="center">
            {week}
          </Typography>

          {weeks[week].map((game) => {
            const homePred = Math.round(game.home_pred_score);
            const awayPred = Math.round(game.away_pred_score);
            const gamePlayed =
              game.home_score !== null && game.away_score !== null;
            const isCorrect = gamePlayed
              ? game.predicted_winner_correct
              : null;

            return (
              <Card
                key={game.game_id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  p: 2,
                  mb: 2,
                  borderRadius: 2,
                  boxShadow: 1,
                  transition: "0.3s",
                  "&:hover": {
                    boxShadow: 4,
                    transform: "scale(1.01)",
                    cursor: "pointer",
                  },
                }}
                onClick={() => setSelectedGame(game)}
              >
                {/* Home Team */}
                <Box display="flex" alignItems="center" width="40%">
                  {renderLogo(game.home_team)}
                  <Box ml={1}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {game.home_team}
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {homePred}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      QB: {game.home_qb_name}
                    </Typography>
                  </Box>
                </Box>

                {/* Actual Score + Spread/O/U */}
                <Box
                  width="20%"
                  display="flex"
                  flexDirection="column"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Typography variant="h4" fontWeight="bold">
                    {gamePlayed
                      ? `${game.home_score} - ${game.away_score}`
                      : "-"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {game.away_team} {game.spread_line > 0 ? `+${game.spread_line}` : game.spread_line}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    O/U: {game.total_line}
                  </Typography>
                </Box>

                {/* Away Team */}
                <Box
                  display="flex"
                  alignItems="center"
                  width="40%"
                  justifyContent="flex-end"
                >
                  <Box textAlign="right" mr={1}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {game.away_team}
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {awayPred}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      QB: {game.away_qb_name}
                    </Typography>
                  </Box>
                  {renderLogo(game.away_team)}
                </Box>

                <Box ml={2}>
                  {gamePlayed ? (
                    <Chip
                      label={isCorrect ? "✅ Correct" : "❌ Wrong"}
                      color={isCorrect ? "success" : "error"}
                      size="medium"
                    />
                  ) : (
                    <Chip
                      label="⏳ Upcoming"
                      color="warning"
                      size="medium"
                    />
                  )}
                </Box>
              </Card>
            );
          })}
        </Box>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mb={5}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(e, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}

      {/* Game Stats Modal */}
      <Modal
        open={!!selectedGame}
        onClose={() => setSelectedGame(null)}
        aria-labelledby="game-stats-modal"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "95%", sm: 700 },
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 4,
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          {selectedGame && (
            <>
              <Typography
                variant="h5"
                fontWeight="bold"
                mb={2}
                textAlign="center"
              >
                {selectedGame.home_team} vs {selectedGame.away_team} (Week{" "}
                {selectedGame.week})
              </Typography>
              <Typography variant="subtitle1" mb={1} textAlign="center">
                Game Time: {selectedGame.gametime} ({selectedGame.gameday})
              </Typography>
              <Typography variant="body1" mb={1} textAlign="center">
                Stadium: {selectedGame.stadium} ({selectedGame.surface},{" "}
                {selectedGame.roof})
              </Typography>
              <Typography variant="body1" mb={3} textAlign="center">
                Weather: {selectedGame.temp}°F, Wind {selectedGame.wind} mph
              </Typography>

              {/* Scores */}
              <Box display="flex" justifyContent="center" mb={4}>
                <Box textAlign="center" mx={3}>
                  <Typography variant="h4" fontWeight="bold">
                    {selectedGame.home_score ?? "-"}
                  </Typography>
                  <Typography variant="subtitle1">
                    {selectedGame.home_team} <br />
                    QB: {selectedGame.home_qb_name}
                  </Typography>
                </Box>
                <Box textAlign="center" mx={3}>
                  <Typography variant="h4" fontWeight="bold">
                    {selectedGame.away_score ?? "-"}
                  </Typography>
                  <Typography variant="subtitle1">
                    {selectedGame.away_team} <br />
                    QB: {selectedGame.away_qb_name}
                  </Typography>
                </Box>
              </Box>

              {/* Predictions */}
              <Box display="flex" justifyContent="center" mb={4}>
                <Box textAlign="center" mx={3}>
                  <Typography variant="body1" color="text.secondary">
                    {Math.round(selectedGame.home_pred_score)}
                  </Typography>
                </Box>
                <Box textAlign="center" mx={3}>
                  <Typography variant="body1" color="text.secondary">
                    {Math.round(selectedGame.away_pred_score)}
                  </Typography>
                </Box>
              </Box>

              {/* Odds Section */}
              <Box mt={3} mb={2}>
                <Typography variant="h6" textAlign="center" gutterBottom>
                  Betting Odds
                </Typography>
                <Box display="flex" justifyContent="center">
                  <Grid container spacing={2} sx={{ maxWidth: 500 }}>
                    <Grid item xs={6}>
                      <Card sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {selectedGame.away_team}
                        </Typography>
                        <Typography variant="body2">
                          Moneyline: {selectedGame.away_moneyline}
                        </Typography>
                        <Typography variant="body2">
                          Spread: {selectedGame.spread_line} (
                          {selectedGame.away_spread_odds})
                        </Typography>
                      </Card>
                    </Grid>
                    <Grid item xs={6}>
                      <Card sx={{ p: 2, textAlign: "center" }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {selectedGame.home_team}
                        </Typography>
                        <Typography variant="body2">
                          Moneyline: {selectedGame.home_moneyline}
                        </Typography>
                        <Typography variant="body2">
                          Spread: {selectedGame.spread_line} (
                          {selectedGame.home_spread_odds})
                        </Typography>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
                <Box mt={2} textAlign="center">
                  <Typography variant="body2">
                    Total: {selectedGame.total_line} (O {selectedGame.over_odds} /
                    U {selectedGame.under_odds})
                  </Typography>
                </Box>
              </Box>

              <Box mt={4}>
                <Typography variant="h6" textAlign="center" gutterBottom>
                  Prediction Stats
                </Typography>

                {/* Bar chart: Predicted vs Actual */}
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={[
                      {
                        name: selectedGame.home_team,
                        Predicted: selectedGame.home_pred_score,
                        Actual: selectedGame.home_score ?? 0,
                      },
                      {
                        name: selectedGame.away_team,
                        Predicted: selectedGame.away_pred_score,
                        Actual: selectedGame.away_score ?? 0,
                      },
                    ]}
                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                  >
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="Predicted" fill="#1976d2" />
                    <Bar dataKey="Actual" fill="#ff6d00" />
                  </BarChart>
                </ResponsiveContainer>

                {/* Pie chart: Predicted winner probability (optional) */}
                {selectedGame.home_pred_score && selectedGame.away_pred_score && (
                  <Box mt={4}>
                    <Typography variant="subtitle1" textAlign="center" gutterBottom>
                      Predicted Winner Share
                    </Typography>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: selectedGame.home_team, value: selectedGame.home_pred_score },
                            { name: selectedGame.away_team, value: selectedGame.away_pred_score },
                          ]}
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {[
                            selectedGame.home_team,
                            selectedGame.away_team
                          ].map((entry, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend verticalAlign="bottom" height={36}/>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </Box>

              {/* Optional: summary cards for quick stats */}
              <Box display="flex" justifyContent="center" gap={2} mt={3} flexWrap="wrap">
                <Card sx={{ p: 2, minWidth: 120, textAlign: "center" }}>
                  <Typography variant="body2">Spread</Typography>
                  <Typography variant="h6">{selectedGame.spread_line > 0 ? `+${selectedGame.spread_line}` : selectedGame.spread_line}</Typography>
                </Card>
                <Card sx={{ p: 2, minWidth: 120, textAlign: "center" }}>
                  <Typography variant="body2">O/U</Typography>
                  <Typography variant="h6">{selectedGame.total_line}</Typography>
                </Card>
                <Card sx={{ p: 2, minWidth: 120, textAlign: "center" }}>
                  <Typography variant="body2">Home Pred</Typography>
                  <Typography variant="h6">{Math.round(selectedGame.home_pred_score)}</Typography>
                </Card>
                <Card sx={{ p: 2, minWidth: 120, textAlign: "center" }}>
                  <Typography variant="body2">Away Pred</Typography>
                  <Typography variant="h6">{Math.round(selectedGame.away_pred_score)}</Typography>
                </Card>
              </Box>

              <Box mt={3} textAlign="center">
                <Button
                  variant="contained"
                  onClick={() => setSelectedGame(null)}
                >
                  Close
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Modal>
    </Box>
  );
}
