export const defaults = {thrust:1,lift:1,drag:1,pitch:1,roll:1,yaw:1,stall:1};

// Legacy numbers are archived verbatim from the supplied v1 HTML.
export const profiles = {
 fighter:{label:'Fighter (Legacy)',mass:1100,area:16,rho:1.18,cruise:62,startHeight:600,
  cl0:.18,slope:4.6,clMin:-1.5,clMax:1.65,critical:.275,stallWidth:.24,postLift:.65,
  cd0:.032,induced:.085,stallDrag:.85,sideDrag:.28,sideForce:.85,
  engine:2800,fadeStart:80,fadeRate:.009,authoritySpeed:58,authorityMin:.10,authorityMax:1.22,stallAuthority:.45,
  pitchPower:.96,pitchStability:1.85,stallMoment:.75,pitchDamping:2.8,
  yawPower:.65,yawStability:2.25,yawDamping:2.5,coordination:.6,coordinationMin:24,
  rollPower:3.45,rollDamping:3.65,warningSpeed:34},
 bush:{label:'Bush',mass:720,area:18.5,rho:1.18,cruise:36.5,startHeight:180,
  cl0:.30,slope:5.4,clMin:-1.65,clMax:1.90,critical:.29,stallWidth:.26,postLift:.85,
  cd0:.04,induced:.07,stallDrag:.60,sideDrag:.28,sideForce:.85,
  engine:1400,fadeStart:35,fadeRate:.008,authoritySpeed:35,authorityMin:.16,authorityMax:1.15,stallAuthority:.32,
  pitchPower:.72,pitchStability:1.6,stallMoment:.22,pitchDamping:3.1,
  yawPower:.48,yawStability:2.25,yawDamping:2.7,coordination:.65,coordinationMin:18,
  rollPower:2.8,rollDamping:3.8,warningSpeed:21.5}
};
