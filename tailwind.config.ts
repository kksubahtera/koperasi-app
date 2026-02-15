import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: {
  			DEFAULT: '1rem',
  			sm: '1.5rem',
  			md: '2rem',
  			lg: '2rem'
  		},
  		screens: {
  			sm: '640px',
  			md: '768px',
  			lg: '1024px',
  			xl: '1280px',
  			'2xl': '1400px'
  		}
  	},
  	screens: {
  		xs: '375px',
  		sm: '640px',
  		md: '768px',
  		lg: '1024px',
  		xl: '1280px',
  		'2xl': '1536px'
  	},
  	extend: {
  		fontFamily: {
  			sans: [
  				'Plus Jakarta Sans',
  				'ui-sans-serif',
  				'system-ui',
  				'sans-serif',
  				'Apple Color Emoji',
  				'Segoe UI Emoji',
  				'Segoe UI Symbol',
  				'Noto Color Emoji'
  			],
  			serif: [
  				'ui-serif',
  				'Georgia',
  				'Cambria',
  				'Times New Roman',
  				'Times',
  				'serif'
  			],
  			mono: [
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Monaco',
  				'Consolas',
  				'Liberation Mono',
  				'Courier New',
  				'monospace'
  			]
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			shimmer: {
  				'100%': {
  					transform: 'translateX(100%)'
  				}
  			},
  			'scroll-bounce': {
  				'0%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(-8px)'
  				},
  				'100%': {
  					transform: 'translateY(0)'
  				}
  			},
  			'scroll-bounce-down': {
  				'0%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(8px)'
  				},
  				'100%': {
  					transform: 'translateY(0)'
  				}
  			},
  			'overscroll-bounce': {
  				'0%, 100%': {
  					transform: 'translateY(0)',
  					opacity: '0'
  				},
  				'50%': {
  					transform: 'translateY(-4px)',
  					opacity: '1'
  				}
  			},
  			'badge-ping': {
  				'0%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				},
  				'50%': {
  					transform: 'scale(1.5)',
  					opacity: '0.5'
  				},
  				'100%': {
  					transform: 'scale(2)',
  					opacity: '0'
  				}
  			},
  			'badge-bounce': {
  				'0%, 100%': {
  					transform: 'translateY(0) scale(1)'
  				},
  				'25%': {
  					transform: 'translateY(-3px) scale(1.1)'
  				},
  				'50%': {
  					transform: 'translateY(0) scale(1)'
  				},
  				'75%': {
  					transform: 'translateY(-2px) scale(1.05)'
  				}
  			},
  			'bell-ring': {
  				'0%': {
  					transform: 'rotate(0deg)'
  				},
  				'10%': {
  					transform: 'rotate(14deg)'
  				},
  				'20%': {
  					transform: 'rotate(-8deg)'
  				},
  				'30%': {
  					transform: 'rotate(14deg)'
  				},
  				'40%': {
  					transform: 'rotate(-4deg)'
  				},
  				'50%': {
  					transform: 'rotate(10deg)'
  				},
  				'60%': {
  					transform: 'rotate(0deg)'
  				},
  				'100%': {
  					transform: 'rotate(0deg)'
  				}
  			},
  			'glow-pulse': {
  				'0%, 100%': {
  					boxShadow: '0 0 5px hsl(var(--destructive) / 0.5), 0 0 10px hsl(var(--destructive) / 0.3)'
  				},
  				'50%': {
  					boxShadow: '0 0 15px hsl(var(--destructive) / 0.8), 0 0 25px hsl(var(--destructive) / 0.5)'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			shimmer: 'shimmer 2s infinite',
  			'scroll-bounce': 'scroll-bounce 0.4s ease-out',
  			'scroll-bounce-down': 'scroll-bounce-down 0.4s ease-out',
  			'overscroll-bounce': 'overscroll-bounce 0.5s ease-out',
  			'badge-ping': 'badge-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
  			'badge-bounce': 'badge-bounce 2s ease-in-out infinite',
  			'bell-ring': 'bell-ring 2s ease-in-out infinite',
  			'glow-pulse': 'glow-pulse 2s ease-in-out infinite'
  		},
  		boxShadow: {
  			glow: 'var(--shadow-glow)',
  			card: 'var(--shadow-md)',
  			'card-hover': 'var(--shadow-lg)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
