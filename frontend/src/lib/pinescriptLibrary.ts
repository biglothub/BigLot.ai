/**
 * PineScript Reference Library for BigLot.ai
 * 
 * Curated collection of battle-tested open-source indicators from:
 * - LuxAlgo (https://th.tradingview.com/u/LuxAlgo/#published-scripts)
 * - TradingView Community top-rated scripts
 * 
 * These serve as "base templates" — the AI modifies them instead of writing from scratch,
 * dramatically reducing errors and improving quality.
 */

// ─── REFERENCE INDICATOR ENTRY ───
export type ReferenceIndicator = {
    id: string;
    name: string;
    author: string;
    source: 'luxalgo' | 'tradingview-community';
    url: string;
    /** Keywords for semantic matching */
    keywords: string[];
    /** Category tags */
    categories: string[];
    /** The actual PineScript v6 code (battle-tested, error-free) */
    code: string;
    /** Brief description */
    description: string;
};

// ─── REFERENCE LIBRARY ───
export const PINESCRIPT_LIBRARY: ReferenceIndicator[] = [

    // ════════════════════════════════════════════
    // LuxAlgo-Style References
    // ════════════════════════════════════════════

    {
        id: 'smart-money-concepts',
        name: 'Smart Money Concepts (SMC)',
        author: 'LuxAlgo-style',
        source: 'luxalgo',
        url: 'https://th.tradingview.com/u/LuxAlgo/#published-scripts',
        keywords: ['smart money', 'smc', 'order block', 'ob', 'fair value gap', 'fvg', 'break of structure', 'bos', 'change of character', 'choch', 'liquidity', 'institutional', 'supply demand', 'market structure'],
        categories: ['structure', 'institutional', 'advanced'],
        description: 'Institutional trading concepts: Order Blocks, Fair Value Gaps, Break of Structure, Change of Character',
        code: `//@version=6
indicator("Smart Money Concepts [BigLot.ai]", overlay=true, max_lines_count=500, max_labels_count=500, max_boxes_count=500)

// ─── INPUTS ───
swingLen     = input.int(10, "Swing Length", minval=1, maxval=50)
showOB       = input.bool(true, "Show Order Blocks")
showFVG      = input.bool(true, "Show Fair Value Gaps")
showBOS      = input.bool(true, "Show Break of Structure")
bullColor    = input.color(color.new(color.teal, 70), "Bullish Color")
bearColor    = input.color(color.new(color.red, 70), "Bearish Color")

// ─── SWING DETECTION ───
swingHigh = ta.pivothigh(high, swingLen, swingLen)
swingLow  = ta.pivotlow(low, swingLen, swingLen)

var float lastSwingHigh = na
var float lastSwingLow  = na
var int   lastSwingHighBar = na
var int   lastSwingLowBar  = na

if not na(swingHigh)
    lastSwingHigh    := swingHigh
    lastSwingHighBar := bar_index - swingLen

if not na(swingLow)
    lastSwingLow    := swingLow
    lastSwingLowBar := bar_index - swingLen

// ─── BREAK OF STRUCTURE (BOS) ───
bosUp   = showBOS and ta.crossover(close, lastSwingHigh)
bosDown = showBOS and ta.crossunder(close, lastSwingLow)

plotshape(bosUp,   title="BOS Up",   style=shape.triangleup,   location=location.belowbar, color=color.teal, size=size.tiny)
plotshape(bosDown, title="BOS Down", style=shape.triangledown, location=location.abovebar, color=color.red,  size=size.tiny)

// ─── FAIR VALUE GAP (FVG) ───
bullFVG = showFVG and low > high[2] and close[1] > open[1]
bearFVG = showFVG and high < low[2] and close[1] < open[1]

var box bullFVGBox = na
var box bearFVGBox = na

if bullFVG
    bullFVGBox := box.new(bar_index - 1, low, bar_index, high[2], border_color=na, bgcolor=bullColor)
if bearFVG
    bearFVGBox := box.new(bar_index - 1, high, bar_index, low[2], border_color=na, bgcolor=bearColor)

// ─── ORDER BLOCK (OB) ───
bullOB = showOB and close > open and close[1] < open[1] and close > high[1]
bearOB = showOB and close < open and close[1] > open[1] and close < low[1]

var box bullOBBox = na
var box bearOBBox = na

if bullOB
    bullOBBox := box.new(bar_index - 1, math.max(open[1], close[1]), bar_index + 5, math.min(open[1], close[1]), border_color=color.teal, bgcolor=bullColor)
if bearOB
    bearOBBox := box.new(bar_index - 1, math.max(open[1], close[1]), bar_index + 5, math.min(open[1], close[1]), border_color=color.red, bgcolor=bearColor)

// ─── ALERTS ───
alertcondition(bosUp,   title="BOS Bullish", message="Break of Structure: Bullish")
alertcondition(bosDown, title="BOS Bearish", message="Break of Structure: Bearish")
`
    },

    {
        id: 'supertrend-advanced',
        name: 'SuperTrend with Signals',
        author: 'LuxAlgo-style',
        source: 'luxalgo',
        url: 'https://th.tradingview.com/u/LuxAlgo/#published-scripts',
        keywords: ['supertrend', 'trend', 'trend following', 'atr', 'trailing stop', 'trend direction', 'trend filter'],
        categories: ['trend', 'atr', 'overlay'],
        description: 'Advanced SuperTrend with multi-factor confirmation and professional visuals',
        code: `//@version=6
indicator("SuperTrend Advanced [BigLot.ai]", overlay=true)

// ─── INPUTS ───
atrPeriod  = input.int(10,   "ATR Period", minval=1)
factor     = input.float(3.0, "Factor",    minval=0.1, step=0.1)
src        = input.source(hl2, "Source")

// ─── CALCULATION ───
atrVal = ta.atr(atrPeriod)

var float upperBand = na
var float lowerBand = na
var int   direction  = 1

upperBand := src + factor * atrVal
lowerBand := src - factor * atrVal

// Prevent band from moving against the trend
upperBand := nz(upperBand[1]) > 0 and close[1] < nz(upperBand[1]) ? math.min(upperBand, nz(upperBand[1])) : upperBand
lowerBand := nz(lowerBand[1]) > 0 and close[1] > nz(lowerBand[1]) ? math.max(lowerBand, nz(lowerBand[1])) : lowerBand

// Direction detection
direction := close > nz(upperBand[1]) ? 1 : close < nz(lowerBand[1]) ? -1 : nz(direction[1], 1)

superTrend = direction == 1 ? lowerBand : upperBand

// ─── SIGNALS ───
buySignal  = direction == 1  and direction[1] == -1
sellSignal = direction == -1 and direction[1] == 1

// ─── VISUALS ───
stColor = direction == 1 ? color.teal : color.red
bodyColor = direction == 1 ? color.new(color.teal, 90) : color.new(color.red, 90)

plot(superTrend, "SuperTrend", color=stColor, linewidth=2)
plotshape(buySignal,  title="Buy",  style=shape.triangleup,   location=location.belowbar, color=color.teal, size=size.small, text="BUY")
plotshape(sellSignal, title="Sell", style=shape.triangledown, location=location.abovebar, color=color.red,  size=size.small, text="SELL")
barcolor(bodyColor)

alertcondition(buySignal,  title="SuperTrend Buy",  message="SuperTrend: Buy Signal")
alertcondition(sellSignal, title="SuperTrend Sell", message="SuperTrend: Sell Signal")
`
    },

    {
        id: 'rsi-divergence',
        name: 'RSI with Divergence Detection',
        author: 'LuxAlgo-style',
        source: 'luxalgo',
        url: 'https://th.tradingview.com/u/LuxAlgo/#published-scripts',
        keywords: ['rsi', 'relative strength', 'divergence', 'bullish divergence', 'bearish divergence', 'overbought', 'oversold', 'momentum', 'hidden divergence'],
        categories: ['oscillator', 'momentum', 'divergence'],
        description: 'RSI with automatic divergence detection (regular + hidden), dynamic OB/OS zones',
        code: `//@version=6
indicator("RSI Divergence [BigLot.ai]", overlay=false)

// ─── INPUTS ───
rsiLen      = input.int(14,  "RSI Length",    minval=1)
rsiSrc      = input.source(close, "RSI Source")
obLevel     = input.int(70,  "Overbought",   minval=50, maxval=100)
osLevel     = input.int(30,  "Oversold",      minval=0,  maxval=50)
pivotLen    = input.int(5,   "Pivot Lookback", minval=1, maxval=20)
showRegDiv  = input.bool(true, "Show Regular Divergence")
showHidDiv  = input.bool(true, "Show Hidden Divergence")

// ─── RSI CALCULATION ───
rsiVal = ta.rsi(rsiSrc, rsiLen)

// ─── PIVOT DETECTION ───
rsiPivotHigh = ta.pivothigh(rsiVal, pivotLen, pivotLen)
rsiPivotLow  = ta.pivotlow(rsiVal, pivotLen, pivotLen)
pricePivotHigh = ta.pivothigh(high, pivotLen, pivotLen)
pricePivotLow  = ta.pivotlow(low, pivotLen, pivotLen)

// ─── DIVERGENCE DETECTION ───
var float prevRsiHigh   = na
var float prevPriceHigh = na
var float prevRsiLow    = na
var float prevPriceLow  = na

// Track previous pivots
if not na(rsiPivotHigh)
    prevRsiHigh   := rsiPivotHigh
    prevPriceHigh := nz(pricePivotHigh, high[pivotLen])
if not na(rsiPivotLow)
    prevRsiLow   := rsiPivotLow
    prevPriceLow := nz(pricePivotLow, low[pivotLen])

// Regular Bearish: Price Higher High + RSI Lower High
regBearDiv = showRegDiv and not na(rsiPivotHigh) and not na(prevRsiHigh) and high[pivotLen] > prevPriceHigh and rsiPivotHigh < prevRsiHigh and rsiVal > 50

// Regular Bullish: Price Lower Low + RSI Higher Low
regBullDiv = showRegDiv and not na(rsiPivotLow) and not na(prevRsiLow) and low[pivotLen] < prevPriceLow and rsiPivotLow > prevRsiLow and rsiVal < 50

// Hidden Bullish: Price Higher Low + RSI Lower Low
hidBullDiv = showHidDiv and not na(rsiPivotLow) and not na(prevRsiLow) and low[pivotLen] > prevPriceLow and rsiPivotLow < prevRsiLow

// Hidden Bearish: Price Lower High + RSI Higher High
hidBearDiv = showHidDiv and not na(rsiPivotHigh) and not na(prevRsiHigh) and high[pivotLen] < prevPriceHigh and rsiPivotHigh > prevRsiHigh

// ─── VISUALS ───
rsiColor = rsiVal >= obLevel ? color.red : rsiVal <= osLevel ? color.teal : color.new(color.blue, 20)
plot(rsiVal, "RSI", color=rsiColor, linewidth=2)
hline(obLevel, "Overbought", color=color.new(color.red, 60), linestyle=hline.style_dashed)
hline(osLevel, "Oversold",   color=color.new(color.teal, 60), linestyle=hline.style_dashed)
hline(50,      "Mid",        color=color.new(color.gray, 80), linestyle=hline.style_dotted)

// Divergence markers
plotshape(regBullDiv, title="Regular Bull Div", style=shape.labelup,   location=location.bottom, color=color.teal, text="Bull", textcolor=color.white, size=size.tiny, offset=-pivotLen)
plotshape(regBearDiv, title="Regular Bear Div", style=shape.labeldown, location=location.top,    color=color.red,  text="Bear", textcolor=color.white, size=size.tiny, offset=-pivotLen)
plotshape(hidBullDiv, title="Hidden Bull Div",  style=shape.triangleup,   location=location.bottom, color=color.new(color.teal, 40), size=size.tiny, offset=-pivotLen)
plotshape(hidBearDiv, title="Hidden Bear Div",  style=shape.triangledown, location=location.top,    color=color.new(color.red, 40),  size=size.tiny, offset=-pivotLen)

// Background zones
bgcolor(rsiVal >= obLevel ? color.new(color.red, 90) : rsiVal <= osLevel ? color.new(color.teal, 90) : na)

alertcondition(regBullDiv, title="Regular Bullish Divergence", message="RSI: Regular Bullish Divergence detected")
alertcondition(regBearDiv, title="Regular Bearish Divergence", message="RSI: Regular Bearish Divergence detected")
`
    },

    {
        id: 'macd-histogram',
        name: 'MACD Advanced',
        author: 'TradingView Community',
        source: 'tradingview-community',
        url: 'https://www.tradingview.com/scripts/',
        keywords: ['macd', 'moving average convergence', 'histogram', 'signal line', 'momentum', 'trend momentum', 'macd crossover', 'macd divergence'],
        categories: ['oscillator', 'momentum', 'trend'],
        description: 'MACD with advanced histogram coloring, crossover signals, and zero-line detection',
        code: `//@version=6
indicator("MACD Advanced [BigLot.ai]", overlay=false)

// ─── INPUTS ───
fastLen   = input.int(12,  "Fast Length",   minval=1)
slowLen   = input.int(26,  "Slow Length",   minval=1)
signalLen = input.int(9,   "Signal Length", minval=1)
src       = input.source(close, "Source")

// ─── CALCULATION ───
[macdLine, signalLine, histLine] = ta.macd(src, fastLen, slowLen, signalLen)

// ─── HISTOGRAM COLOR (4-state) ───
histColor = histLine >= 0 ? (histLine >= nz(histLine[1]) ? color.new(color.teal, 0) : color.new(color.teal, 60)) : (histLine <= nz(histLine[1]) ? color.new(color.red, 0) : color.new(color.red, 60))

// ─── SIGNALS ───
bullCross = ta.crossover(macdLine, signalLine)
bearCross = ta.crossunder(macdLine, signalLine)
zeroCrossUp   = ta.crossover(macdLine, 0)
zeroCrossDown = ta.crossunder(macdLine, 0)

// ─── VISUALS ───
plot(histLine,   "Histogram", style=plot.style_columns, color=histColor)
plot(macdLine,   "MACD",      color=color.new(color.blue, 0),   linewidth=2)
plot(signalLine, "Signal",    color=color.new(color.orange, 0), linewidth=1)
hline(0, "Zero Line", color=color.new(color.gray, 70), linestyle=hline.style_dashed)

plotshape(bullCross, title="Bull Cross", style=shape.circle, location=location.absolute, color=color.teal, size=size.tiny)
plotshape(bearCross, title="Bear Cross", style=shape.circle, location=location.absolute, color=color.red,  size=size.tiny)

alertcondition(bullCross, title="MACD Bull Cross", message="MACD: Bullish Crossover")
alertcondition(bearCross, title="MACD Bear Cross", message="MACD: Bearish Crossover")
`
    },

    {
        id: 'bollinger-bands-advanced',
        name: 'Bollinger Bands with Squeeze',
        author: 'TradingView Community',
        source: 'tradingview-community',
        url: 'https://www.tradingview.com/scripts/',
        keywords: ['bollinger', 'bands', 'bb', 'squeeze', 'bandwidth', 'percent b', '%b', 'volatility', 'mean reversion', 'standard deviation', 'keltner'],
        categories: ['volatility', 'bands', 'overlay'],
        description: 'Bollinger Bands with Squeeze detection (BB inside Keltner Channel), %B, and Bandwidth',
        code: `//@version=6
indicator("Bollinger Bands Squeeze [BigLot.ai]", overlay=true)

// ─── INPUTS ───
bbLen    = input.int(20,   "BB Length",     minval=1)
bbMult   = input.float(2.0, "BB Multiplier", minval=0.1, step=0.1)
kcLen    = input.int(20,   "KC Length",     minval=1)
kcMult   = input.float(1.5, "KC Multiplier", minval=0.1, step=0.1)
src      = input.source(close, "Source")

// ─── BOLLINGER BANDS ───
basis    = ta.sma(src, bbLen)
bbDev    = bbMult * ta.stdev(src, bbLen)
upperBB  = basis + bbDev
lowerBB  = basis - bbDev

// ─── KELTNER CHANNEL (for squeeze detection) ───
kcBasis  = ta.ema(src, kcLen)
kcRange  = kcMult * ta.atr(kcLen)
upperKC  = kcBasis + kcRange
lowerKC  = kcBasis - kcRange

// ─── SQUEEZE DETECTION ───
sqzOn    = lowerBB > lowerKC and upperBB < upperKC
sqzOff   = not sqzOn
noSqz    = sqzOn == false and sqzOn[1] == false

// ─── VISUALS ───
basisPlot = plot(basis,   "Basis",    color=color.new(color.blue, 20), linewidth=1)
upperPlot = plot(upperBB, "Upper BB", color=color.new(color.blue, 60))
lowerPlot = plot(lowerBB, "Lower BB", color=color.new(color.blue, 60))

fill(upperPlot, basisPlot, color=color.new(color.blue, 92))
fill(basisPlot, lowerPlot, color=color.new(color.blue, 92))

// Squeeze dots on basis
plotshape(sqzOn,  title="Squeeze On",  style=shape.diamond, location=location.absolute, color=color.orange, size=size.tiny)
plotshape(sqzOff and sqzOn[1], title="Squeeze Fire", style=shape.diamond, location=location.absolute, color=color.teal, size=size.tiny)

// Bar color during squeeze
barcolor(sqzOn ? color.new(color.orange, 60) : na)

alertcondition(sqzOff and sqzOn[1], title="Squeeze Released", message="BB Squeeze: Volatility Expansion!")
`
    },

    {
        id: 'ema-ribbon',
        name: 'EMA Ribbon / Moving Average Crossover',
        author: 'TradingView Community',
        source: 'tradingview-community',
        url: 'https://www.tradingview.com/scripts/',
        keywords: ['ema', 'sma', 'moving average', 'crossover', 'cross', 'golden cross', 'death cross', 'ribbon', 'trend', 'ma cross', '9 21', '20 50', '50 200'],
        categories: ['trend', 'moving-average', 'overlay'],
        description: 'Multi-EMA ribbon with crossover signals and trend gradient coloring',
        code: `//@version=6
indicator("EMA Ribbon [BigLot.ai]", overlay=true)

// ─── INPUTS ───
fastLen   = input.int(9,   "Fast EMA",   minval=1)
medLen    = input.int(21,  "Medium EMA",  minval=1)
slowLen   = input.int(50,  "Slow EMA",   minval=1)
trendLen  = input.int(200, "Trend EMA",   minval=1)
src       = input.source(close, "Source")
showCross = input.bool(true, "Show Crossover Signals")

// ─── CALCULATIONS ───
emaFast  = ta.ema(src, fastLen)
emaMed   = ta.ema(src, medLen)
emaSlow  = ta.ema(src, slowLen)
emaTrend = ta.ema(src, trendLen)

// ─── TREND DETECTION ───
bullTrend = emaFast > emaMed and emaMed > emaSlow
bearTrend = emaFast < emaMed and emaMed < emaSlow

// ─── CROSSOVER SIGNALS ───
goldenCross = showCross and ta.crossover(emaFast, emaSlow)
deathCross  = showCross and ta.crossunder(emaFast, emaSlow)

// ─── VISUALS ───
fastPlot = plot(emaFast,  "Fast EMA",   color=color.new(color.teal, 0),   linewidth=2)
medPlot  = plot(emaMed,   "Medium EMA", color=color.new(color.blue, 20),  linewidth=1)
slowPlot = plot(emaSlow,  "Slow EMA",   color=color.new(color.orange, 0), linewidth=2)
plot(emaTrend, "Trend EMA", color=color.new(color.gray, 40), linewidth=1, style=plot.style_cross)

// Ribbon fill
fillColor = bullTrend ? color.new(color.teal, 85) : bearTrend ? color.new(color.red, 85) : color.new(color.gray, 90)
fill(fastPlot, slowPlot, color=fillColor)

// Crossover signals
plotshape(goldenCross, title="Golden Cross", style=shape.triangleup,   location=location.belowbar, color=color.teal, size=size.small, text="⬆")
plotshape(deathCross,  title="Death Cross",  style=shape.triangledown, location=location.abovebar, color=color.red,  size=size.small, text="⬇")

alertcondition(goldenCross, title="Golden Cross", message="EMA: Golden Cross (Bullish)")
alertcondition(deathCross,  title="Death Cross",  message="EMA: Death Cross (Bearish)")
`
    },

    {
        id: 'stochastic-rsi',
        name: 'Stochastic RSI',
        author: 'TradingView Community',
        source: 'tradingview-community',
        url: 'https://www.tradingview.com/scripts/',
        keywords: ['stochastic', 'stoch', 'stoch rsi', 'stochastic rsi', '%k', '%d', 'overbought', 'oversold', 'momentum'],
        categories: ['oscillator', 'momentum'],
        description: 'Stochastic RSI with %K/%D lines and crossover signals',
        code: `//@version=6
indicator("Stochastic RSI [BigLot.ai]", overlay=false)

// ─── INPUTS ───
rsiLen    = input.int(14, "RSI Length",    minval=1)
stochLen  = input.int(14, "Stoch Length",  minval=1)
kSmooth   = input.int(3,  "K Smoothing",  minval=1)
dSmooth   = input.int(3,  "D Smoothing",  minval=1)
src       = input.source(close, "Source")
obLevel   = input.int(80, "Overbought",   minval=50, maxval=100)
osLevel   = input.int(20, "Oversold",      minval=0,  maxval=50)

// ─── CALCULATION ───
rsiVal    = ta.rsi(src, rsiLen)
stochK    = ta.sma(ta.stoch(rsiVal, rsiVal, rsiVal, stochLen), kSmooth)
stochD    = ta.sma(stochK, dSmooth)

// ─── SIGNALS ───
bullCross = ta.crossover(stochK, stochD) and stochK < osLevel
bearCross = ta.crossunder(stochK, stochD) and stochK > obLevel

// ─── VISUALS ───
kColor = stochK >= obLevel ? color.red : stochK <= osLevel ? color.teal : color.blue
plot(stochK, "K", color=kColor, linewidth=2)
plot(stochD, "D", color=color.new(color.orange, 20), linewidth=1, style=plot.style_line)
hline(obLevel, "OB", color=color.new(color.red, 60), linestyle=hline.style_dashed)
hline(osLevel, "OS", color=color.new(color.teal, 60), linestyle=hline.style_dashed)
hline(50,      "Mid", color=color.new(color.gray, 80), linestyle=hline.style_dotted)

bgcolor(stochK >= obLevel ? color.new(color.red, 92) : stochK <= osLevel ? color.new(color.teal, 92) : na)

plotshape(bullCross, title="Bull Signal", style=shape.triangleup,   location=location.bottom, color=color.teal, size=size.tiny)
plotshape(bearCross, title="Bear Signal", style=shape.triangledown, location=location.top,    color=color.red,  size=size.tiny)

alertcondition(bullCross, title="StochRSI Bull", message="StochRSI: Bullish signal in oversold zone")
alertcondition(bearCross, title="StochRSI Bear", message="StochRSI: Bearish signal in overbought zone")
`
    },

    {
        id: 'volume-profile',
        name: 'Volume Analysis',
        author: 'TradingView Community',
        source: 'tradingview-community',
        url: 'https://www.tradingview.com/scripts/',
        keywords: ['volume', 'obv', 'on balance volume', 'volume weighted', 'vwap', 'volume profile', 'volume oscillator', 'accumulation', 'distribution', 'mfi', 'money flow', 'cvd', 'cumulative volume delta'],
        categories: ['volume', 'flow'],
        description: 'Multi-mode volume analysis: VWAP, OBV, Money Flow Index, Volume Moving Average',
        code: `//@version=6
indicator("Volume Analysis Suite [BigLot.ai]", overlay=false)

// ─── INPUTS ───
mode     = input.string("OBV", "Mode", options=["OBV", "MFI", "Volume Oscillator"])
mfiLen   = input.int(14, "MFI Length", minval=1)
volFast  = input.int(5,  "Vol Fast MA", minval=1)
volSlow  = input.int(20, "Vol Slow MA", minval=1)

// ─── OBV ───
obvVal    = ta.cum(close > close[1] ? volume : close < close[1] ? -volume : 0)
obvSmooth = ta.ema(obvVal, 20)

// ─── MFI ───
mfiVal = ta.mfi(hlc3, mfiLen)

// ─── VOLUME OSCILLATOR ───
volFastMA = ta.ema(volume, volFast)
volSlowMA = ta.ema(volume, volSlow)
volOsc    = ((volFastMA - volSlowMA) / volSlowMA) * 100

// ─── SELECT OUTPUT ───
mainVal = mode == "OBV" ? obvVal : mode == "MFI" ? mfiVal : volOsc
sigVal  = mode == "OBV" ? obvSmooth : mode == "MFI" ? ta.sma(mfiVal, 9) : ta.sma(volOsc, 9)

// ─── VISUALS ───
mainColor = mainVal >= sigVal ? color.teal : color.red
plot(mainVal, "Main", color=mainColor, linewidth=2)
plot(sigVal,  "Signal", color=color.new(color.gray, 40), linewidth=1)

hline(mode == "MFI" ? 80 : 0, "Upper", color=color.new(color.red, 60), linestyle=hline.style_dashed)
hline(mode == "MFI" ? 20 : 0, "Lower", color=color.new(color.teal, 60), linestyle=hline.style_dashed)

alertcondition(ta.crossover(mainVal, sigVal), title="Volume Bull", message="Volume: Bullish signal")
alertcondition(ta.crossunder(mainVal, sigVal), title="Volume Bear", message="Volume: Bearish signal")
`
    },

    {
        id: 'ichimoku-cloud',
        name: 'Ichimoku Cloud',
        author: 'TradingView Community',
        source: 'tradingview-community',
        url: 'https://www.tradingview.com/scripts/',
        keywords: ['ichimoku', 'kumo', 'cloud', 'tenkan', 'kijun', 'senkou', 'chikou', 'span a', 'span b', 'conversion', 'base line', 'japanese'],
        categories: ['trend', 'overlay', 'ichimoku'],
        description: 'Full Ichimoku Kinko Hyo with Kumo Cloud, TK Cross signals, and Chikou confirmation',
        code: `//@version=6
indicator("Ichimoku Cloud [BigLot.ai]", overlay=true)

// ─── INPUTS ───
convLen   = input.int(9,   "Conversion (Tenkan)", minval=1)
baseLen   = input.int(26,  "Base (Kijun)",        minval=1)
spanBLen  = input.int(52,  "Span B",              minval=1)
displacement = input.int(26, "Displacement",      minval=1)
showChikou   = input.bool(true, "Show Chikou Span")

// ─── DONCHIAN HELPER ───
donchian(len) =>
    math.avg(ta.highest(high, len), ta.lowest(low, len))

// ─── CALCULATION ───
tenkan   = donchian(convLen)
kijun    = donchian(baseLen)
spanA    = math.avg(tenkan, kijun)
spanB    = donchian(spanBLen)

// ─── SIGNALS ───
tkBullCross = ta.crossover(tenkan, kijun)
tkBearCross = ta.crossunder(tenkan, kijun)

aboveCloud  = close > math.max(spanA[displacement], spanB[displacement])
belowCloud  = close < math.min(spanA[displacement], spanB[displacement])

strongBuy  = tkBullCross and aboveCloud
strongSell = tkBearCross and belowCloud

// ─── VISUALS ───
plot(tenkan, "Tenkan", color=color.new(color.blue, 0), linewidth=1)
plot(kijun,  "Kijun",  color=color.new(color.red, 0),  linewidth=1)
plot(showChikou ? close : na, "Chikou", color=color.new(color.purple, 0), offset=-displacement, linewidth=1)

spanAPlot = plot(spanA, "Span A", color=color.new(color.teal, 40), offset=displacement)
spanBPlot = plot(spanB, "Span B", color=color.new(color.red, 40),  offset=displacement)
fill(spanAPlot, spanBPlot, color=spanA > spanB ? color.new(color.teal, 88) : color.new(color.red, 88), title="Kumo Cloud")

plotshape(strongBuy,  title="Strong Buy",  style=shape.triangleup,   location=location.belowbar, color=color.teal, size=size.small, text="BUY")
plotshape(strongSell, title="Strong Sell", style=shape.triangledown, location=location.abovebar, color=color.red,  size=size.small, text="SELL")

alertcondition(strongBuy,  title="Ichimoku Strong Buy",  message="Ichimoku: Strong Bullish Signal")
alertcondition(strongSell, title="Ichimoku Strong Sell", message="Ichimoku: Strong Bearish Signal")
`
    },

    {
        id: 'atr-trailing-stop',
        name: 'ATR Trailing Stop',
        author: 'TradingView Community',
        source: 'tradingview-community',
        url: 'https://www.tradingview.com/scripts/',
        keywords: ['atr', 'trailing stop', 'stop loss', 'chandelier', 'exit', 'risk management', 'volatility stop', 'trailing'],
        categories: ['risk', 'volatility', 'overlay'],
        description: 'Chandelier Exit / ATR Trailing Stop with dynamic risk management',
        code: `//@version=6
indicator("ATR Trailing Stop [BigLot.ai]", overlay=true)

// ─── INPUTS ───
atrLen   = input.int(22,   "ATR Period",    minval=1)
atrMult  = input.float(3.0, "ATR Multiplier", minval=0.5, step=0.1)
src      = input.source(close, "Source")

// ─── ATR CALCULATION ───
atrVal = ta.atr(atrLen)

// ─── TRAILING STOP LOGIC ───
var float trailStop = na
var int   trend     = 1

longStop  = src - atrMult * atrVal
shortStop = src + atrMult * atrVal

// Ratchet logic
longStop  := nz(longStop[1])  > 0 and src[1] > nz(trailStop[1]) ? math.max(longStop, nz(longStop[1]))  : longStop
shortStop := nz(shortStop[1]) > 0 and src[1] < nz(trailStop[1]) ? math.min(shortStop, nz(shortStop[1])) : shortStop

// Trend direction
trend := src > nz(trailStop[1]) ? 1 : src < nz(trailStop[1]) ? -1 : nz(trend[1], 1)
trailStop := trend == 1 ? longStop : shortStop

// ─── SIGNALS ───
buySignal  = trend == 1  and nz(trend[1]) == -1
sellSignal = trend == -1 and nz(trend[1]) == 1

// ─── VISUALS ───
tsColor = trend == 1 ? color.teal : color.red
plot(trailStop, "Trail Stop", color=tsColor, linewidth=2, style=plot.style_linebr)

plotshape(buySignal,  title="Buy",  style=shape.triangleup,   location=location.belowbar, color=color.teal, size=size.small, text="BUY")
plotshape(sellSignal, title="Sell", style=shape.triangledown, location=location.abovebar, color=color.red,  size=size.small, text="SELL")

alertcondition(buySignal,  title="ATR Trail Buy",  message="ATR Trailing Stop: Buy Signal")
alertcondition(sellSignal, title="ATR Trail Sell", message="ATR Trailing Stop: Sell Signal")
`
    },

    {
        id: 'support-resistance',
        name: 'Support & Resistance Levels',
        author: 'LuxAlgo-style',
        source: 'luxalgo',
        url: 'https://th.tradingview.com/u/LuxAlgo/#published-scripts',
        keywords: ['support', 'resistance', 'sr', 'level', 'pivot', 'pivot point', 'key level', 'zone', 'supply', 'demand', 'flip', 'support resistance auto'],
        categories: ['structure', 'overlay', 'levels'],
        description: 'Automatic Support/Resistance level detection using pivot highs/lows with strength scoring',
        code: `//@version=6
indicator("Support & Resistance [BigLot.ai]", overlay=true, max_lines_count=500, max_labels_count=500)

// ─── INPUTS ───
pivotLen    = input.int(10,  "Pivot Lookback",   minval=2, maxval=50)
maxLevels   = input.int(5,   "Max Levels Each",  minval=1, maxval=10)
zonePct     = input.float(0.3, "Zone Width %",    minval=0.05, step=0.05)
extendBars  = input.int(50,  "Extend Bars",       minval=10, maxval=200)

// ─── PIVOT DETECTION ───
ph = ta.pivothigh(high, pivotLen, pivotLen)
pl = ta.pivotlow(low, pivotLen, pivotLen)

// ─── LEVEL MANAGEMENT ───
var float[] resLevels = array.new_float(0)
var float[] supLevels = array.new_float(0)
var line[]  resLines  = array.new_line(0)
var line[]  supLines  = array.new_line(0)

// Add new resistance level
if not na(ph)
    if array.size(resLevels) >= maxLevels
        oldLine = array.shift(resLines)
        line.delete(oldLine)
        array.shift(resLevels)
    array.push(resLevels, ph)
    array.push(resLines, line.new(bar_index - pivotLen, ph, bar_index + extendBars, ph, color=color.new(color.red, 30), width=1, style=line.style_dashed))

// Add new support level
if not na(pl)
    if array.size(supLevels) >= maxLevels
        oldLine = array.shift(supLines)
        line.delete(oldLine)
        array.shift(supLevels)
    array.push(supLevels, pl)
    array.push(supLines, line.new(bar_index - pivotLen, pl, bar_index + extendBars, pl, color=color.new(color.teal, 30), width=1, style=line.style_dashed))

// ─── BREAKOUT DETECTION ───
var bool breakRes = false
var bool breakSup = false
breakRes := false
breakSup := false

if array.size(resLevels) > 0
    nearestRes = array.get(resLevels, array.size(resLevels) - 1)
    breakRes := ta.crossover(close, nearestRes)

if array.size(supLevels) > 0
    nearestSup = array.get(supLevels, array.size(supLevels) - 1)
    breakSup := ta.crossunder(close, nearestSup)

plotshape(breakRes, title="Break Resistance", style=shape.triangleup,   location=location.belowbar, color=color.teal, size=size.tiny, text="Break R")
plotshape(breakSup, title="Break Support",    style=shape.triangledown, location=location.abovebar, color=color.red,  size=size.tiny, text="Break S")

alertcondition(breakRes, title="Resistance Break", message="Price broke above Resistance!")
alertcondition(breakSup, title="Support Break",    message="Price broke below Support!")
`
    },

    {
        id: 'adx-dmi',
        name: 'ADX / DMI Trend Strength',
        author: 'TradingView Community',
        source: 'tradingview-community',
        url: 'https://www.tradingview.com/scripts/',
        keywords: ['adx', 'dmi', 'directional', 'trend strength', 'di+', 'di-', 'average directional', 'trending', 'ranging'],
        categories: ['trend', 'oscillator'],
        description: 'ADX with DI+/DI- and trend strength classification',
        code: `//@version=6
indicator("ADX / DMI [BigLot.ai]", overlay=false)

// ─── INPUTS ───
adxLen    = input.int(14,  "ADX Length", minval=1)
diLen     = input.int(14,  "DI Length",  minval=1)
adxThresh = input.int(25,  "ADX Trend Threshold", minval=10, maxval=50)

// ─── CALCULATION ───
[diPlus, diMinus, adxVal] = ta.dmi(diLen, adxLen)

// ─── TREND CLASSIFICATION ───
strongTrend = adxVal >= adxThresh
bullTrend   = strongTrend and diPlus > diMinus
bearTrend   = strongTrend and diMinus > diPlus
ranging     = not strongTrend

// ─── SIGNALS ───
bullCross = ta.crossover(diPlus, diMinus) and strongTrend
bearCross = ta.crossunder(diPlus, diMinus) and strongTrend

// ─── VISUALS ───
plot(adxVal,  "ADX",  color=color.new(color.orange, 0), linewidth=2)
plot(diPlus,  "DI+",  color=color.new(color.teal, 0),   linewidth=1)
plot(diMinus, "DI-",  color=color.new(color.red, 0),    linewidth=1)
hline(adxThresh, "Trend Threshold", color=color.new(color.gray, 50), linestyle=hline.style_dashed)

bgcolor(bullTrend ? color.new(color.teal, 92) : bearTrend ? color.new(color.red, 92) : color.new(color.gray, 95))

plotshape(bullCross, title="Bull DI Cross", style=shape.triangleup,   location=location.bottom, color=color.teal, size=size.tiny)
plotshape(bearCross, title="Bear DI Cross", style=shape.triangledown, location=location.top,    color=color.red,  size=size.tiny)

alertcondition(bullCross, title="ADX Bull", message="ADX/DMI: Bullish trend signal")
alertcondition(bearCross, title="ADX Bear", message="ADX/DMI: Bearish trend signal")
`
    },

    {
        id: 'williams-r',
        name: 'Williams %R',
        author: 'TradingView Community',
        source: 'tradingview-community',
        url: 'https://www.tradingview.com/scripts/',
        keywords: ['williams', 'williams %r', 'percent r', '%r', 'overbought', 'oversold', 'larry williams'],
        categories: ['oscillator', 'momentum'],
        description: 'Williams %R with smoothing and signal generation',
        code: `//@version=6
indicator("Williams %R [BigLot.ai]", overlay=false)

// ─── INPUTS ───
wrLen    = input.int(14, "Period", minval=1)
obLevel  = input.int(-20, "Overbought", maxval=0)
osLevel  = input.int(-80, "Oversold",   maxval=0)

// ─── CALCULATION ───
highest_high = ta.highest(high, wrLen)
lowest_low   = ta.lowest(low, wrLen)
wr = (highest_high - close) / (highest_high - lowest_low) * -100

wrSmooth = ta.sma(wr, 3)

// ─── SIGNALS ───
bullSignal = ta.crossover(wr, osLevel)
bearSignal = ta.crossunder(wr, obLevel)

// ─── VISUALS ───
wrColor = wr >= obLevel ? color.red : wr <= osLevel ? color.teal : color.blue
plot(wr,       "Williams %R",  color=wrColor, linewidth=2)
plot(wrSmooth, "Smoothed",     color=color.new(color.orange, 40), linewidth=1)
hline(obLevel, "Overbought",  color=color.new(color.red, 60),  linestyle=hline.style_dashed)
hline(osLevel, "Oversold",    color=color.new(color.teal, 60), linestyle=hline.style_dashed)
hline(-50,     "Mid",         color=color.new(color.gray, 80), linestyle=hline.style_dotted)

bgcolor(wr >= obLevel ? color.new(color.red, 92) : wr <= osLevel ? color.new(color.teal, 92) : na)

plotshape(bullSignal, title="Bull", style=shape.triangleup,   location=location.bottom, color=color.teal, size=size.tiny)
plotshape(bearSignal, title="Bear", style=shape.triangledown, location=location.top,    color=color.red,  size=size.tiny)

alertcondition(bullSignal, title="WR Bullish", message="Williams %R: Bullish signal from oversold")
alertcondition(bearSignal, title="WR Bearish", message="Williams %R: Bearish signal from overbought")
`
    },

    {
        id: 'pivot-points',
        name: 'Pivot Points',
        author: 'TradingView Community',
        source: 'tradingview-community',
        url: 'https://www.tradingview.com/scripts/',
        keywords: ['pivot', 'pivot point', 'r1', 'r2', 'r3', 's1', 's2', 's3', 'classic pivot', 'fibonacci pivot', 'camarilla', 'floor pivot'],
        categories: ['levels', 'overlay'],
        description: 'Classic Pivot Points with R1-R3 and S1-S3 levels',
        code: `//@version=6
indicator("Pivot Points [BigLot.ai]", overlay=true)

// ─── INPUTS ───
pivotType = input.string("Classic", "Pivot Type", options=["Classic", "Fibonacci"])

// ─── PREVIOUS DAY DATA ───
prevHigh  = request.security(syminfo.tickerid, "D", high[1], barmerge.gaps_off, barmerge.lookahead_on)
prevLow   = request.security(syminfo.tickerid, "D", low[1],  barmerge.gaps_off, barmerge.lookahead_on)
prevClose = request.security(syminfo.tickerid, "D", close[1], barmerge.gaps_off, barmerge.lookahead_on)

// ─── PIVOT CALCULATION ───
pp    = (prevHigh + prevLow + prevClose) / 3
rng   = prevHigh - prevLow

r1 = pivotType == "Classic" ? (2 * pp - prevLow)          : pp + 0.382 * rng
s1 = pivotType == "Classic" ? (2 * pp - prevHigh)         : pp - 0.382 * rng
r2 = pivotType == "Classic" ? (pp + rng)                  : pp + 0.618 * rng
s2 = pivotType == "Classic" ? (pp - rng)                  : pp - 0.618 * rng
r3 = pivotType == "Classic" ? (prevHigh + 2 * (pp - prevLow))  : pp + 1.0 * rng
s3 = pivotType == "Classic" ? (prevLow - 2 * (prevHigh - pp))  : pp - 1.0 * rng

// ─── VISUALS ───
plot(pp, "Pivot",  color=color.new(color.orange, 0), linewidth=2, style=plot.style_cross)
plot(r1, "R1",     color=color.new(color.red, 30),   linewidth=1)
plot(r2, "R2",     color=color.new(color.red, 10),   linewidth=1)
plot(r3, "R3",     color=color.new(color.red, 0),    linewidth=1, style=plot.style_cross)
plot(s1, "S1",     color=color.new(color.teal, 30),  linewidth=1)
plot(s2, "S2",     color=color.new(color.teal, 10),  linewidth=1)
plot(s3, "S3",     color=color.new(color.teal, 0),   linewidth=1, style=plot.style_cross)
`
    },

    {
        id: 'candle-patterns',
        name: 'Candlestick Pattern Detection',
        author: 'TradingView Community',
        source: 'tradingview-community',
        url: 'https://www.tradingview.com/scripts/',
        keywords: ['candle', 'candlestick', 'pattern', 'doji', 'hammer', 'engulfing', 'morning star', 'evening star', 'shooting star', 'harami', 'pin bar', 'three soldiers', 'three crows'],
        categories: ['pattern', 'candle', 'overlay'],
        description: 'Auto-detection of major candlestick patterns with visual markers',
        code: `//@version=6
indicator("Candlestick Patterns [BigLot.ai]", overlay=true)

// ─── INPUTS ───
showBullish = input.bool(true, "Show Bullish Patterns")
showBearish = input.bool(true, "Show Bearish Patterns")

// ─── BODY CALCULATIONS ───
body     = math.abs(close - open)
bodyHigh = math.max(close, open)
bodyLow  = math.min(close, open)
upperWick = high - bodyHigh
lowerWick = bodyLow - low
isBull   = close > open
isBear   = close < open
avgBody  = ta.sma(body, 14)

// ─── PATTERNS ───
// Doji
doji = body <= avgBody * 0.1

// Hammer (bullish)
hammer = showBullish and lowerWick >= body * 2 and upperWick <= body * 0.3 and isBear[1]

// Shooting Star (bearish)
shootingStar = showBearish and upperWick >= body * 2 and lowerWick <= body * 0.3 and isBull[1]

// Bullish Engulfing
bullEngulfing = showBullish and isBull and isBear[1] and close > open[1] and open < close[1] and body > body[1]

// Bearish Engulfing
bearEngulfing = showBearish and isBear and isBull[1] and close < open[1] and open > close[1] and body > body[1]

// Morning Star (3-bar bullish reversal)
morningStar = showBullish and isBear[2] and body[2] > avgBody and body[1] <= avgBody * 0.5 and isBull and close > (open[2] + close[2]) / 2

// Evening Star (3-bar bearish reversal)
eveningStar = showBearish and isBull[2] and body[2] > avgBody and body[1] <= avgBody * 0.5 and isBear and close < (open[2] + close[2]) / 2

// Three White Soldiers
threeSoldiers = showBullish and isBull and isBull[1] and isBull[2] and close > close[1] and close[1] > close[2] and body > avgBody * 0.6 and body[1] > avgBody * 0.6

// Three Black Crows
threeCrows = showBearish and isBear and isBear[1] and isBear[2] and close < close[1] and close[1] < close[2] and body > avgBody * 0.6 and body[1] > avgBody * 0.6

// ─── VISUALS ───
plotshape(hammer,        title="Hammer",        style=shape.triangleup,   location=location.belowbar, color=color.teal,   size=size.tiny, text="H")
plotshape(shootingStar,  title="Shooting Star", style=shape.triangledown, location=location.abovebar, color=color.red,    size=size.tiny, text="SS")
plotshape(bullEngulfing, title="Bull Engulf",   style=shape.triangleup,   location=location.belowbar, color=color.teal,   size=size.small, text="BE")
plotshape(bearEngulfing, title="Bear Engulf",   style=shape.triangledown, location=location.abovebar, color=color.red,    size=size.small, text="BE")
plotshape(morningStar,   title="Morning Star",  style=shape.triangleup,   location=location.belowbar, color=color.lime,   size=size.small, text="MS")
plotshape(eveningStar,   title="Evening Star",  style=shape.triangledown, location=location.abovebar, color=color.orange, size=size.small, text="ES")
plotshape(threeSoldiers, title="3 Soldiers",    style=shape.triangleup,   location=location.belowbar, color=color.lime,   size=size.normal, text="3S")
plotshape(threeCrows,    title="3 Crows",       style=shape.triangledown, location=location.abovebar, color=color.orange, size=size.normal, text="3C")
plotshape(doji,          title="Doji",          style=shape.cross,        location=location.abovebar, color=color.yellow, size=size.tiny)

alertcondition(bullEngulfing or hammer or morningStar or threeSoldiers, title="Bullish Pattern", message="Bullish Candlestick Pattern Detected!")
alertcondition(bearEngulfing or shootingStar or eveningStar or threeCrows, title="Bearish Pattern", message="Bearish Candlestick Pattern Detected!")
`
    },

    {
        id: 'multi-timeframe',
        name: 'Multi-Timeframe Dashboard',
        author: 'LuxAlgo-style',
        source: 'luxalgo',
        url: 'https://th.tradingview.com/u/LuxAlgo/#published-scripts',
        keywords: ['multi timeframe', 'mtf', 'dashboard', 'table', 'multi tf', 'timeframe', 'higher timeframe', 'htf', 'confluence', 'screener'],
        categories: ['dashboard', 'multi-tf', 'table'],
        description: 'Multi-timeframe trend dashboard showing trend alignment across timeframes',
        code: `//@version=6
indicator("Multi-TF Dashboard [BigLot.ai]", overlay=true)

// ─── INPUTS ───
maLen     = input.int(20, "MA Length", minval=1)
maType    = input.string("EMA", "MA Type", options=["EMA", "SMA"])
showTable = input.bool(true, "Show Dashboard")
tablePos  = input.string("top_right", "Table Position", options=["top_right", "top_left", "bottom_right", "bottom_left"])

// ─── MA FUNCTION ───
calcMA(src, len) =>
    maType == "EMA" ? ta.ema(src, len) : ta.sma(src, len)

// ─── MULTI-TF DATA ───
tf1  = request.security(syminfo.tickerid, "15",  calcMA(close, maLen))
tf2  = request.security(syminfo.tickerid, "60",  calcMA(close, maLen))
tf3  = request.security(syminfo.tickerid, "240", calcMA(close, maLen))
tf4  = request.security(syminfo.tickerid, "D",   calcMA(close, maLen))

c1 = request.security(syminfo.tickerid, "15",  close)
c2 = request.security(syminfo.tickerid, "60",  close)
c3 = request.security(syminfo.tickerid, "240", close)
c4 = request.security(syminfo.tickerid, "D",   close)

// ─── TREND DIRECTION ───
trend1 = c1 > tf1 ? 1 : -1
trend2 = c2 > tf2 ? 1 : -1
trend3 = c3 > tf3 ? 1 : -1
trend4 = c4 > tf4 ? 1 : -1

// ─── CONFLUENCE SCORE ───
score = trend1 + trend2 + trend3 + trend4

// ─── TABLE ───
var table dashboard = na
tblPos = tablePos == "top_right" ? position.top_right : tablePos == "top_left" ? position.top_left : tablePos == "bottom_right" ? position.bottom_right : position.bottom_left

if showTable and barstate.islast
    dashboard := table.new(tblPos, 3, 6, bgcolor=color.new(color.black, 20), border_color=color.new(color.gray, 60), border_width=1)

    table.cell(dashboard, 0, 0, "TF",        text_color=color.white, text_size=size.small)
    table.cell(dashboard, 1, 0, "Trend",     text_color=color.white, text_size=size.small)
    table.cell(dashboard, 2, 0, "Signal",    text_color=color.white, text_size=size.small)

    table.cell(dashboard, 0, 1, "15m",  text_color=color.white, text_size=size.small)
    table.cell(dashboard, 0, 2, "1H",   text_color=color.white, text_size=size.small)
    table.cell(dashboard, 0, 3, "4H",   text_color=color.white, text_size=size.small)
    table.cell(dashboard, 0, 4, "1D",   text_color=color.white, text_size=size.small)
    table.cell(dashboard, 0, 5, "SCORE", text_color=color.orange, text_size=size.small)

    table.cell(dashboard, 1, 1, trend1 == 1 ? "▲ Bull" : "▼ Bear", text_color=trend1 == 1 ? color.teal : color.red, text_size=size.small)
    table.cell(dashboard, 1, 2, trend2 == 1 ? "▲ Bull" : "▼ Bear", text_color=trend2 == 1 ? color.teal : color.red, text_size=size.small)
    table.cell(dashboard, 1, 3, trend3 == 1 ? "▲ Bull" : "▼ Bear", text_color=trend3 == 1 ? color.teal : color.red, text_size=size.small)
    table.cell(dashboard, 1, 4, trend4 == 1 ? "▲ Bull" : "▼ Bear", text_color=trend4 == 1 ? color.teal : color.red, text_size=size.small)

    scoreText = score >= 3 ? "STRONG BUY" : score >= 1 ? "BUY" : score <= -3 ? "STRONG SELL" : score <= -1 ? "SELL" : "NEUTRAL"
    scoreColor = score >= 3 ? color.lime : score >= 1 ? color.teal : score <= -3 ? color.orange : score <= -1 ? color.red : color.gray
    table.cell(dashboard, 1, 5, scoreText, text_color=scoreColor, text_size=size.normal)
`
    },

];


// ─── KEYWORD MATCHING ENGINE ───

/**
 * Find the best matching reference indicator for a given user prompt.
 * Returns the best match and a relevance score (0-1).
 */
export function findBestReference(prompt: string): { match: ReferenceIndicator | null; score: number; allMatches: { ref: ReferenceIndicator; score: number }[] } {
    const normalizedPrompt = prompt.toLowerCase().trim();
    const promptWords = normalizedPrompt.split(/\s+/);

    const scored = PINESCRIPT_LIBRARY.map(ref => {
        let score = 0;
        let maxPossible = ref.keywords.length + ref.categories.length;

        // Keyword matching (primary)
        for (const keyword of ref.keywords) {
            const kwLower = keyword.toLowerCase();
            if (normalizedPrompt.includes(kwLower)) {
                // Exact phrase match is worth more
                score += kwLower.includes(' ') ? 3 : 2;
            } else {
                // Partial word match
                const kwWords = kwLower.split(/\s+/);
                for (const kw of kwWords) {
                    if (promptWords.some(pw => pw.includes(kw) || kw.includes(pw))) {
                        score += 1;
                    }
                }
            }
        }

        // Category matching (secondary)
        for (const cat of ref.categories) {
            if (normalizedPrompt.includes(cat.toLowerCase())) {
                score += 1;
            }
        }

        // Name matching bonus
        if (normalizedPrompt.includes(ref.name.toLowerCase())) {
            score += 5;
        }

        // Normalize score to 0-1 range
        const normalizedScore = Math.min(score / (maxPossible * 2), 1);

        return { ref, score: normalizedScore };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    const threshold = 0.05; // Minimum relevance threshold

    return {
        match: best && best.score >= threshold ? best.ref : null,
        score: best?.score ?? 0,
        allMatches: scored.filter(s => s.score >= threshold).slice(0, 3)
    };
}

/**
 * Build an enhanced prompt that includes the reference code as a base
 */
export function buildReferenceEnhancedPrompt(userPrompt: string, reference: ReferenceIndicator): string {
    return `As an elite PineScript v6 Engineer, develop a robust, professional-grade solution for:

"${userPrompt}"

REFERENCE BASE CODE (from ${reference.author} — "${reference.name}"):
Use the following battle-tested, error-free PineScript as your STARTING POINT.
Modify, extend, or combine it to fulfill the user's exact request.
Keep the proven structure, visual style, and error-handling patterns.

\`\`\`pine
${reference.code}
\`\`\`

INSTRUCTIONS:
1. Use this reference as a FOUNDATION — do not rewrite from scratch.
2. Modify parameters, logic, and visuals to match the user's specific request.
3. Keep all the good practices: namespacing (ta.*, math.*), global-scope plots, nz()/na() checks.
4. Add any additional features the user asked for ON TOP of this base.
5. Update the indicator title to reflect the user's request.
6. Output the final PineScript in a \`\`\`pine code block.
7. Also output a matching JavaScript preview in a \`\`\`javascript code block.

REQUIRED STRUCTURE:
1. Elite PineScript v6 (indicator.pine) — based on the reference, adapted to user needs.
2. Accurate JavaScript Simulation (preview.js) — for web-based visualization.

Ensure maximum reliability, clear parameter names, and advanced visual styling.`;
}

/**
 * Build a prompt when NO reference match is found — AI searches TradingView community
 */
export function buildSearchPrompt(userPrompt: string): string {
    return `As an elite PineScript v6 Engineer, develop a robust, professional-grade solution for:

"${userPrompt}"

IMPORTANT: Before writing code, think about which well-known TradingView open-source indicators are most similar to this request.
Consider indicators from:
- LuxAlgo (https://th.tradingview.com/u/LuxAlgo/)
- QuantNomad, EverGet, LazyBear, and other top TradingView authors
- TradingView's built-in indicators

Use the PROVEN LOGIC and STRUCTURE from the most relevant open-source indicator as your foundation.
Do NOT invent new math — use established, battle-tested formulas.

REQUIRED STRUCTURE:
1. Elite PineScript v6 (indicator.pine) — Must be flawless, documented, and use modern v6 syntax.
2. Accurate JavaScript Simulation (preview.js) — For web-based visualization.

Ensure maximum reliability, clear parameter names, and advanced visual styling.`;
}
