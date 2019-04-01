module.exports = {
  knownConditionInputs: [
    'TIME', 'SUN', 'YEAR_PROGRESS', 'AMBIENT', 'FOG', 'RAIN', 'FLAG_TYPE', 'ONE', 'wfx_WET' 
  ],
  knownShaderProperties: [ 
    'ksAmbient', 'ksDiffuse', 'ksSpecular', 'ksSpecularEXP', 'ksEmissive', 'ksAlphaRef',
    'alpha', 'blurLevel', 'bo', 'boh', 'damageZones', 'detailNMMult', 'detailNormalBlend', 'detailUVMultiplier', 
    'diffuseMult', 'dirt', 'dirtyLevel', 'fresnelC', 'fresnelEXP', 'fresnelMaxLevel', 'gain', 'glassDamage', 
    'glowLevel', 'isAdditive', 'magicMult', 'multA', 'multB', 'multG', 'multR', 'nmObjectSpace', 'normalMult', 
    'normalUVMultiplier', 'padding', 'scale', 'seasonAutumn', 'seasonWinter', 'shadowBiasMult', 'sunSpecular', 
    'sunSpecularEXP', 'tarmacSpecularMultiplier', 'useDetail' 
  ],
  trackBasicKeys: [ 
    'RALLY_TRACK', 'PITBOXES'
  ],
  trackLightingKeys: [ 
    'LIT_MULT', 'CAR_LIGHTS_LIT_MULT', 'SPECULAR_MULT', 'BOUNCED_LIGHT_MULT', 'TRACK_AMBIENT_GROUND_MULT', 
    'ENABLE_TREES_LIGHTING',
  ],
  trackModelReplacementKeys: [ 
    'FILE', 'INSERT_AFTER', 'INSERT', 'HIDE', 'DESCRIPTION'
  ],
  trackLightKeys: [ 
    'ACTIVE', 'MESH', 'OFFSET', 'CLUSTER_THRESHOLD', 'POSITION', 'LINE_FROM', 'LINE_TO', 'DIRECTION', 'COLOR', 
    'COLOR_FROM', 'SPECULAR_MULT', 'COLOR_TO', 'COLOR', 'SPECULAR_MULT', 'SPOT', 'SPOT_SHARPNESS', 'FADE_AT', 
    'FADE_SMOOTH', 'RANGE', 'RANGE_GRADIENT_OFFSET', 'SINGLE_FREQUENCY', 'DIFFUSE_CONCENTRATION', 'CONDITION', 
    'CONDITION_OFFSET', 'DESCRIPTION', 'VISIBILITY_LEVEL'
  ],
  trackLightSeriesKeys: [ 
    'ACTIVE', 'CLUSTER_THRESHOLD', 'MESHES', 'MATERIALS', 'OFFSET', 'DIRECTION', 'DIRECTION_ALTER', 'DIRECTION_OFFSET', 
    'SPOT', 'SPOT_SHARPNESS', 'FADE_AT', 'FADE_SMOOTH', 'RANGE', 'RANGE_GRADIENT_OFFSET', 'SINGLE_FREQUENCY', 
    'DIFFUSE_CONCENTRATION', 'CONDITION', 'CONDITION_OFFSET', 'DIRECTION', 'COLOR', 'SPECULAR_MULT', 'DESCRIPTION',
    'VISIBILITY_LEVEL'
  ],
  meshAdjustmentKeys: [
    'MESHES', 'IS_TRANSPARENT', 'IS_RENDERABLE', 'IS_ACTIVE'
  ],
  trackMaterialAdjustmentKeys: [
    'ACTIVE', 'DESCRIPTION', 'VISIBILITY_LEVEL', 'MATERIALS', 'MESHES', 'CONDITION', 'CONDITION_OFFSET', 'BLEND_MODE', 'DEPTH_MODE'
  ],
  trackConditionKeys: [
    'INPUT', 'NAME', 'LUT', 'LAG', 'LAG_DELAY_ON', 'LAG_DELAY_OFF', 'INPUT_CHANGE_DELAY', 'INPUT_STAY_FOR', 
    'SIMULATE_HEATING', 'FLASHING_FREQUENCY', 'FLASHING_MIN_VALUE', 'FLASHING_SKIP_OFF_STATE', 'FLASHING_SKIP_DOWNHILL_STATE', 
    'FLASHING_SMOOTHNESS', 'FLASHING_SMOOTHNESS', 'FLASHING_NOISE_AMPLITUDE', 'FLASHING_NOISE_BOUND', 'FLASHING_NOISE_SPEED', 
    'FLASHING_LUT', 'FLASHING_SYNCED', 'LAG_DELAY_FUNC'
  ],
  trackConditionFunc: [
    'SQR', 'POW3', 'SQRT', 'LINEAR'
  ],
};