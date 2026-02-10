<script lang="ts">
    interface Props {
        status?: "idle" | "analyzing" | "buying" | "selling";
        size?: "sm" | "md" | "lg";
        showLabel?: boolean;
    }

    let { status = "idle", size = "md", showLabel = true }: Props = $props();

    const statusConfig = {
        idle: {
            color: "text-cyan-400",
            label: "",
            glow: "shadow-cyan-500/50",
            eyeColor: "#22d3ee", // cyan-400
        },
        analyzing: {
            color: "text-purple-400",
            label: "ANALYZING MARKET",
            glow: "shadow-purple-500/50",
            eyeColor: "#a855f7", // purple-500
        },
        buying: {
            color: "text-emerald-400",
            label: "BUYING GOLD",
            glow: "shadow-emerald-500/50",
            eyeColor: "#34d399", // emerald-400
        },
        selling: {
            color: "text-rose-400",
            label: "SELLING GOLD",
            glow: "shadow-rose-500/50",
            eyeColor: "#fb7185", // rose-400
        },
    };

    const sizeConfig = {
        sm: "w-8 h-8",
        md: "w-24 h-24",
        lg: "w-48 h-48",
    };

    let currentConfig = $derived(statusConfig[status]);
    let currentSize = $derived(sizeConfig[size]);
</script>

<div
    class="flex flex-col items-center justify-center gap-2 transition-all duration-500"
>
    <div class={`relative ${currentSize} transition-all duration-500`}>
        <!-- Glow Effect behind the robot -->
        <div
            class={`absolute inset-0 rounded-full blur-3xl opacity-30 transition-colors duration-500 ${currentConfig.glow.replace(
                "shadow",
                "bg",
            )}`}
        ></div>

        <!-- Robot SVG -->
        <svg
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="w-full h-full drop-shadow-xl z-10 relative"
        >
            <!-- Bobbing Animation Group -->
            <g class="animate-float">
                <!-- Antenna -->
                <line
                    x1="100"
                    y1="50"
                    x2="100"
                    y2="30"
                    stroke="#fbbf24"
                    stroke-width="4"
                />
                <circle
                    cx="100"
                    cy="25"
                    r="6"
                    class={`${status === "analyzing" ? "animate-ping" : ""}`}
                    fill={status === "idle"
                        ? "#fbbf24"
                        : currentConfig.eyeColor}
                />

                <!-- Head (Gold Plated) -->
                <rect
                    x="50"
                    y="50"
                    width="100"
                    height="90"
                    rx="20"
                    fill="url(#goldGradient)"
                    stroke="#B45309"
                    stroke-width="2"
                />

                <!-- Screen (Face) -->
                <rect
                    x="60"
                    y="70"
                    width="80"
                    height="50"
                    rx="10"
                    fill="#0f172a"
                />

                <!-- Reflection on head -->
                <path
                    d="M60 60 H 140 A 10 10 0 0 0 140 60"
                    stroke="white"
                    stroke-opacity="0.3"
                    stroke-width="4"
                    stroke-linecap="round"
                />

                <!-- Eyes Container -->
                <g transform="translate(0, 5)">
                    {#if status === "idle"}
                        <!-- Blink Animation -->
                        <g
                            class="animate-blink origin-center"
                            style="transform-box: fill-box;"
                        >
                            <circle
                                cx="80"
                                cy="90"
                                r="8"
                                fill={currentConfig.eyeColor}
                            />
                            <circle
                                cx="120"
                                cy="90"
                                r="8"
                                fill={currentConfig.eyeColor}
                            />
                        </g>
                    {:else if status === "analyzing"}
                        <!-- Scanning Animation -->
                        <rect
                            x="70"
                            y="88"
                            width="60"
                            height="4"
                            rx="2"
                            fill="#1e293b"
                        />
                        <rect
                            x="70"
                            y="88"
                            width="20"
                            height="4"
                            rx="2"
                            fill={currentConfig.eyeColor}
                            class="animate-scan"
                        />
                    {:else if status === "buying"}
                        <!-- Money Eyes ($ $) -->
                        <text
                            x="75"
                            y="100"
                            font-family="monospace"
                            font-weight="bold"
                            font-size="24"
                            fill={currentConfig.eyeColor}>$</text
                        >
                        <text
                            x="115"
                            y="100"
                            font-family="monospace"
                            font-weight="bold"
                            font-size="24"
                            fill={currentConfig.eyeColor}>$</text
                        >
                    {:else if status === "selling"}
                        <!-- Exclamation / Alert Eyes -->
                        <rect
                            x="78"
                            y="82"
                            width="4"
                            height="12"
                            rx="1"
                            fill={currentConfig.eyeColor}
                        />
                        <rect
                            x="78"
                            y="98"
                            width="4"
                            height="4"
                            rx="1"
                            fill={currentConfig.eyeColor}
                        />

                        <rect
                            x="118"
                            y="82"
                            width="4"
                            height="12"
                            rx="1"
                            fill={currentConfig.eyeColor}
                        />
                        <rect
                            x="118"
                            y="98"
                            width="4"
                            height="4"
                            rx="1"
                            fill={currentConfig.eyeColor}
                        />
                    {/if}
                </g>

                <!-- Mouth (Smile) -->
                <path
                    d="M 90 130 Q 100 135 110 130"
                    stroke={status === "selling" ? "#fb7185" : "#fbbf24"}
                    stroke-width="3"
                    stroke-linecap="round"
                    fill="none"
                />
            </g>

            <!-- Gradients -->
            <defs>
                <linearGradient
                    id="goldGradient"
                    x1="50"
                    y1="50"
                    x2="150"
                    y2="140"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0%" stop-color="#FCD34D" />
                    <stop offset="50%" stop-color="#fbbf24" />
                    <stop offset="100%" stop-color="#d97706" />
                </linearGradient>
            </defs>
        </svg>
    </div>

    {#if showLabel && currentConfig.label}
        <div
            class="glass-panel px-4 py-1.5 flex items-center gap-2 transition-all duration-500 rounded-full border border-yellow-500/20"
        >
            <div
                class={`w-2 h-2 rounded-full ${status === "idle" ? "bg-cyan-400" : status === "analyzing" ? "bg-purple-400" : status === "buying" ? "bg-emerald-400" : "bg-rose-400"} animate-pulse`}
            ></div>
            <span
                class={`text-[10px] font-mono tracking-[0.15em] font-bold ${currentConfig.color}`}
            >
                {currentConfig.label}
            </span>
        </div>
    {/if}
</div>

<style>
    @keyframes float {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-5px);
        }
    }
    .animate-float {
        animation: float 3s ease-in-out infinite;
    }

    @keyframes blink {
        0%,
        90%,
        100% {
            transform: scaleY(1);
        }
        95% {
            transform: scaleY(0.1);
        }
    }
    .animate-blink {
        animation: blink 4s infinite;
    }

    @keyframes scan {
        0%,
        100% {
            transform: translateX(0);
        }
        50% {
            transform: translateX(40px);
        }
    }
    .animate-scan {
        animation: scan 1.5s linear infinite;
    }
</style>
