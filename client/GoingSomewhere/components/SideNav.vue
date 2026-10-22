<script setup>
const props = defineProps({
    open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open'])

const ICONS = {
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    budget: '<path d="M4 12c0-3 2-6 6-6h4c4 0 6 3 6 6 0 2-1 3-2 4v3h-3v-2h-4v2H6v-3c-1-1-2-2-2-4z"/>',
    checklist: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 10 2 2 4-4M8 16h8"/>',
    profile: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6 19c1.5-2.5 3.5-3.5 6-3.5s4.5 1 6 3.5"/>',
}

const items = [
    { label: 'Discover places', icon: 'search', to: '/discover' },
    { label: 'My itinerary planner', icon: 'calendar', to: '/itinerary' },
    { label: 'My budget planner', icon: 'budget', to: '/budget' },
    { label: 'My checklist', icon: 'checklist', to: '/checklist' },
]
</script>

<template>
    <nav class="side-nav" :class="{ open: props.open }">
        <button class="toggle" type="button" :aria-expanded="props.open"
            :aria-label="props.open ? 'Close menu' : 'Open menu'" @click="emit('update:open', !props.open)">
            {{ props.open ? '<' : '☰' }}
        </button>

        <ul class="links">
            <li v-for="item in items" :key="item.to">
                <RouterLink :to="item.to" :title="item.label">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"
                        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                        v-html="ICONS[item.icon]"></svg>
                    <span v-if="props.open" class="label">{{ item.label }}</span>
                </RouterLink>
            </li>
        </ul>

        <RouterLink to="/profile" class="profile" title="My profile">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"
                aria-hidden="true" v-html="ICONS.profile"></svg>
            <span v-if="props.open" class="label">My profile</span>
        </RouterLink>
    </nav>
</template>

<style scoped>
.side-nav {
    width: 64px;
    height: 100vh;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    padding: 16px 0;
    background: #d9d9d9;
    color: #141b2d;
    transition: width 0.3s ease;
    overflow: hidden;
}

.side-nav.open {
    width: 250px;
}

.toggle {
    align-self: flex-start;
    margin: 0 0 40px 18px;
    background: none;
    border: 0;
    font-size: 1.6rem;
    line-height: 1;
    color: #141b2d;
}

.side-nav.open .toggle {
    align-self: flex-end;
    margin-right: 18px;
}

.links,
.links li {
    list-style: none;
    padding: 0;
    margin: 0;
}

.side-nav a {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 20px;
    color: #141b2d;
    text-decoration: none;
    white-space: nowrap;
}

.side-nav a:hover,
.side-nav a.router-link-active {
    color: #2f80ed;
}

.profile {
    margin-top: auto;
}

.label {
    font-size: 0.95rem;
}
</style>