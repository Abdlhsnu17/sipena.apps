ALTER TABLE `dss_ranking_history`
  ADD COLUMN `pairwise_matrix_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
    CHECK (`pairwise_matrix_json` IS NULL OR json_valid(`pairwise_matrix_json`))
  AFTER `weights_json`;
