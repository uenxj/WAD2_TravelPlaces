<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
    <div class="container">
      <RouterLink class="navbar-brand fw-bold" to="/">✈ GoingSomewhere</RouterLink>
      <div class="navbar-nav ms-auto flex-row gap-3">
        <RouterLink class="nav-link" to="/">Home</RouterLink>
        <RouterLink class="nav-link" to="/play">Guess the Country</RouterLink>
        <RouterLink class="nav-link" to="/budget">Budget Planner</RouterLink>
      </div>
    </div>
  </nav>
  <RouterView />
</template>