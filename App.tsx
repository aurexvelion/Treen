import React, {useEffect,useState} from 'react';
import {Alert,SafeAreaView,ScrollView,StatusBar,StyleSheet,Text,TextInput,TouchableOpacity,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
const KEY='treen_bodybuilding_v2';
const green='#76E39D', bg='#07100B', panel='#102017', muted='#9BAEA1';
type Day='MON'|'WED'|'THU';
type Ex={name:string,sets:number,low:number,high:number};
const PLAN:Record<Day,{title:string,focus:string,ex:Ex[]}>={
MON:{title:'Full Body',focus:'Chest, quads and foundational strength',ex:[
{name:'Leg press',sets:3,low:10,high:12},{name:'Machine chest press',sets:3,low:8,high:12},{name:'Lat pulldown',sets:3,low:8,high:12},{name:'Seated leg curl',sets:2,low:10,high:15},{name:'Dumbbell biceps curl',sets:2,low:10,high:15}]},
WED:{title:'Lower Body + Back',focus:'Legs, posterior chain and pulling',ex:[
{name:'Smith machine squat',sets:3,low:8,high:12},{name:'Seated cable row',sets:3,low:8,high:12},{name:'Dumbbell Romanian deadlift',sets:2,low:8,high:12},{name:'Leg extension',sets:2,low:12,high:15},{name:'Standing calf raise',sets:3,low:12,high:20},{name:'Cable crunch',sets:2,low:12,high:15}]},
THU:{title:'Upper Body',focus:'Chest, shoulders and arms',ex:[
{name:'Incline dumbbell press',sets:3,low:8,high:12},{name:'Machine shoulder press',sets:3,low:8,high:12},{name:'Chest-supported row (light)',sets:2,low:10,high:12},{name:'Dumbbell lateral raise',sets:3,low:12,high:20},{name:'Cable triceps pushdown',sets:3,low:10,high:15},{name:'Hammer curl',sets:2,low:10,high:15}]}
};
type Entry={weight:string,reps:string};
type Measure={weight:string,waist:string,arm:string,chest:string,thigh:string,pushups:string,pullups:string};
type State={week:number,logs:Record<string,Entry>,done:string[],measures:Record<string,Measure>};
const emptyMeasure=():Measure=>({weight:'',waist:'',arm:'',chest:'',thigh:'',pushups:'',pullups:''});
const initial:State={week:1,logs:{},done:[],measures:{'0':{...emptyMeasure(),weight:'80',pushups:'5'}}};
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const dateFrom=(value:string)=>{
 const [year,month,day]=value.split('-').map(Number);
 return new Date(year,month-1,day);
};
const dateId=(value:Date)=>[value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
const workoutFor=(value:string):Day|null=>{
 const weekday=dateFrom(value).getDay();
 return weekday===1?'MON':weekday===3?'WED':weekday===4?'THU':null;
};
const weekWorkoutDate=(value:string,day:Day)=>{
 const d=dateFrom(value);
 const mondayOffset=(d.getDay()+6)%7;
 d.setDate(d.getDate()-mondayOffset+({MON:0,WED:2,THU:3}[day]));
 return dateId(d);
};
const monthCells=(month:Date)=>{
 const first=new Date(month.getFullYear(),month.getMonth(),1);
 const offset=(first.getDay()+6)%7;
 const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const length=Math.ceil((offset+days)/7)*7;
 return Array.from({length},(_,i)=>{
  const current=new Date(month.getFullYear(),month.getMonth(),i-offset+1);
  return {date:dateId(current),inMonth:current.getMonth()===month.getMonth()};
 });
};
const Btn=({label,onPress,subtle=false}:{label:string,onPress:()=>void,subtle?:boolean})=><TouchableOpacity onPress={onPress} style={[s.btn,subtle&&s.subtle]}><Text style={[s.btnText,subtle&&{color:green}]}>{label}</Text></TouchableOpacity>;
export default function App(){
 const [data,setData]=useState<State>(initial),[ready,setReady]=useState(false);
 const [tab,setTab]=useState<'train'|'calendar'|'plan'|'progress'|'timer'>('train');
 const [day,setDay]=useState<Day>(()=>workoutFor(today())||'MON');
 const [sessionDate,setSessionDate]=useState(()=>weekWorkoutDate(today(),workoutFor(today())||'MON'));
 const [pickedDate,setPickedDate]=useState(today);
 const [calendarMonth,setCalendarMonth]=useState(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)});
 const [seconds,setSeconds]=useState(90),[running,setRunning]=useState(false);
 useEffect(()=>{AsyncStorage.getItem(KEY).then(v=>{if(v){try{setData({...initial,...JSON.parse(v)})}catch{}}}).finally(()=>setReady(true))},[]);
 useEffect(()=>{if(ready)AsyncStorage.setItem(KEY,JSON.stringify(data)).catch(()=>{})},[data,ready]);
 useEffect(()=>{if(!running)return;const id=setInterval(()=>setSeconds(v=>{if(v<=1){setRunning(false);return 0}return v-1}),1000);return()=>clearInterval(id)},[running]);
 const change=(fn:(p:State)=>State)=>setData(p=>fn(p));
 const date=today(),sessionKey=sessionDate+'-'+day,work=PLAN[day],sets=(ex:Ex)=>data.week<=2?Math.min(2,ex.sets):ex.sets;
 const selectedCalendarWorkout=workoutFor(pickedDate);
 const calendarDays=monthCells(calendarMonth);
 const setLog=(key:string,field:keyof Entry,val:string)=>change(p=>({...p,logs:{...p.logs,[key]:{...(p.logs[key]||{weight:'',reps:''}),[field]:val}}}));
 const measure=(checkpoint:string,field:keyof Measure,val:string)=>change(p=>({...p,measures:{...p.measures,[checkpoint]:{...(p.measures[checkpoint]||emptyMeasure()),[field]:val}}}));
 const [check,setCheck]=useState('0');
 const m=data.measures[check]||emptyMeasure();
 async function exportLog(){
  try{
   const entries=Object.entries(data.logs).filter(([,v])=>!!(v.weight.trim()||v.reps.trim())).map(([key,value])=>{
    const [session,exercise,setIndex]=key.split('|');
    const match=session.match(/^(\d{4}-\d{2}-\d{2})-(MON|WED|THU)$/);
    return {date:match?match[1]:session,day:match?match[2]:null,exercise,set:Number(setIndex)+1,weightKg:value.weight||null,reps:value.reps||null};
   }).sort((a,b)=>a.date.localeCompare(b.date)||a.exercise.localeCompare(b.exercise)||a.set-b.set);
   const payload={
    format:'treen-training-log',version:1,exportedAt:new Date().toISOString(),
    currentTrainingWeek:data.week,
    schedule:{MON:'Full Body',WED:'Lower Body + Back',THU:'Upper Body'},
    trainingPlan:PLAN,
    completedWorkouts:[...data.done].sort(),
    measurements:data.measures,
    loggedSets:entries
   };
   const file=new File(Paths.cache,'treen-training-log-'+date+'.json');
   file.create({overwrite:true});
   file.write(JSON.stringify(payload,null,2));
   if(!await Sharing.isAvailableAsync()){
    Alert.alert('Sharing unavailable','File export requires the Android or iOS share menu.');
    return;
   }
   await Sharing.shareAsync(file.uri,{mimeType:'application/json',dialogTitle:'Save or send T.R.E.E.N. training log',UTI:'public.json'});
  }catch(error){
   Alert.alert('Export failed',error instanceof Error?error.message:'Could not save the training log.');
  }
 }
 const card=(children:React.ReactNode)=><View style={s.card}>{children}</View>;
 const label=(value:string)=><Text style={s.label}>{value}</Text>;
 const input=(value:string,changeValue:(v:string)=>void,placeholder:string)=><TextInput keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor="#607567" style={s.input} value={value} onChangeText={changeValue}/>;
 const exercise=(ex:Ex,i:number)=>{const count=sets(ex);return <View key={ex.name} style={s.card}><Text style={s.heading}>{i+1}. {ex.name}</Text><Text style={s.muted}>{count} sets × {ex.low}–{ex.high} reps · Leave 1–3 reps in reserve</Text>{Array.from({length:count},(_,j)=>{const key=sessionKey+'|'+ex.name+'|'+j;const v=data.logs[key]||{weight:'',reps:''};return <View key={key} style={s.setRow}><Text style={s.setLabel}>Set {j+1}</Text>{input(v.weight,x=>setLog(key,'weight',x),'kg')}{input(v.reps,x=>setLog(key,'reps',x),'reps')}</View>})}</View>};
 if(!ready)return <SafeAreaView style={s.safe}><Text style={s.logo}>T.R.E.E.N.</Text></SafeAreaView>;
 return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/><View style={s.header}><Text style={s.kicker}>12-WEEK BODYBUILDING EXPERIMENT</Text><Text style={s.logo}>T.R.E.E.N.</Text><Text style={s.muted}>Week {data.week} of 12 · 3 days per week</Text></View>
 <View style={s.nav}>{(['train','calendar','plan','progress','timer'] as const).map(t=><TouchableOpacity key={t} onPress={()=>setTab(t)} style={[s.navItem,tab===t&&s.navActive]}><Text style={[s.navText,tab===t&&{color:green}]}>{t.toUpperCase()}</Text></TouchableOpacity>)}</View>
 <ScrollView contentContainerStyle={s.content}>
 {tab==='calendar'&&<>
 {card(<>
  <View style={s.monthHeader}>
   <TouchableOpacity accessibilityLabel="Previous month" onPress={()=>setCalendarMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1))} style={s.monthArrow}><Text style={s.monthArrowText}>‹</Text></TouchableOpacity>
   <Text style={s.heading}>{calendarMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</Text>
   <TouchableOpacity accessibilityLabel="Next month" onPress={()=>setCalendarMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1))} style={s.monthArrow}><Text style={s.monthArrowText}>›</Text></TouchableOpacity>
  </View>
  <View style={s.calendarGrid}>
   {['M','T','W','T','F','S','S'].map((w,i)=><Text key={i} style={s.calendarWeekday}>{w}</Text>)}
   {calendarDays.map(cell=>{
    const training=workoutFor(cell.date);
    const picked=cell.date===pickedDate;
    const completed=!!training&&data.done.includes(cell.date+'-'+training);
    const isToday=cell.date===today();
    return <View key={cell.date} style={s.calendarCell}>
     <TouchableOpacity accessibilityLabel={cell.date+(training?' workout':' rest')} onPress={()=>{
      setPickedDate(cell.date);
      if(!cell.inMonth){const d=dateFrom(cell.date);setCalendarMonth(new Date(d.getFullYear(),d.getMonth(),1));}
     }} style={[s.calendarDate,picked&&s.calendarSelected,isToday&&!picked&&s.calendarToday]}>
      <Text style={[s.calendarDateText,!cell.inMonth&&s.calendarDim,picked&&s.calendarSelectedText]}>{dateFrom(cell.date).getDate()}</Text>
      <Text style={[s.calendarDot,picked&&s.calendarSelectedText]}>{completed?'✓':training?'●':' '}</Text>
     </TouchableOpacity>
    </View>;
   })}
  </View>
  <Text style={s.muted}>● Training day    ✓ Completed    Tap a date to see its exercises</Text>
  <Btn label="JUMP TO TODAY" subtle onPress={()=>{
   const now=new Date();setPickedDate(dateId(now));setCalendarMonth(new Date(now.getFullYear(),now.getMonth(),1));
  }}/>
 </>)}
 {card(<>
  <Text style={s.kicker}>{dateFrom(pickedDate).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</Text>
  <Text style={s.hero}>{selectedCalendarWorkout?PLAN[selectedCalendarWorkout].title:'Rest day'}</Text>
  {selectedCalendarWorkout?<>
   <Text style={s.muted}>{PLAN[selectedCalendarWorkout].focus}</Text>
   {PLAN[selectedCalendarWorkout].ex.map((ex,i)=><View key={ex.name} style={s.calendarExercise}><Text style={s.exerciseCalendarName}>{i+1}. {ex.name}</Text><Text style={s.muted}>{data.week<=2?Math.min(2,ex.sets):ex.sets} × {ex.low}–{ex.high}</Text></View>)}
   {data.done.includes(pickedDate+'-'+selectedCalendarWorkout)&&<Text style={s.finishedText}>✓ Workout completed</Text>}
   <Btn label="OPEN THIS WORKOUT" onPress={()=>{
    setDay(selectedCalendarWorkout);setSessionDate(pickedDate);setTab('train');
   }}/>
  </>:<Text style={s.muted}>No scheduled lifting. Rest, walk, or recover from military activities.</Text>}
 </>)}
 </>}
 {tab==='train'&&<><View style={s.days}>{(['MON','WED','THU'] as Day[]).map(d=><TouchableOpacity key={d} onPress={()=>{setDay(d);setSessionDate(weekWorkoutDate(sessionDate,d));}} style={[s.day,day===d&&s.dayActive]}><Text style={[s.dayText,day===d&&{color:bg}]}>{d}</Text></TouchableOpacity>)}</View>
 {card(<><Text style={s.kicker}>{dateFrom(sessionDate).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · INDOOR GYM</Text><Text style={s.hero}>{work.title}</Text><Text style={s.muted}>{work.focus}</Text><Text style={s.muted}>Warm up 5–10 min. Rest 2–3 min for compound lifts, 60–90 sec for isolation lifts.</Text></>)}
 {work.ex.map(exercise)}
 <Btn label={data.done.includes(sessionKey)?'✓ WORKOUT COMPLETED':'✓ COMPLETE WORKOUT'} onPress={()=>change(p=>({...p,done:p.done.includes(sessionKey)?p.done:[...p.done,sessionKey]}))}/>
 <Text style={s.muted}>Your set logs are saved on this device. Use a weight you can control; add weight after reaching the top of the rep range on every set.</Text></>}
 {tab==='plan'&&<>{card(<><Text style={s.heading}>12-week progression</Text><Text style={s.muted}>Weeks 1–2: 2 sets per exercise, learn technique, leave 3–4 reps in reserve.</Text><Text style={s.muted}>Weeks 3–6: listed sets, add repetitions and then weight.</Text><Text style={s.muted}>Weeks 7–10: progressive overload, usually 1–3 reps in reserve.</Text><Text style={s.muted}>Weeks 11–12: consistent training and final measurements.</Text></>)}
 {card(<><Text style={s.heading}>Current training week</Text><Text style={s.hero}>{data.week} / 12</Text><View style={s.days}><Btn label="− Week" subtle onPress={()=>change(p=>({...p,week:Math.max(1,p.week-1)}))}/><Btn label="+ Week" subtle onPress={()=>change(p=>({...p,week:Math.min(12,p.week+1)}))}/></View></>)}
 {(['MON','WED','THU'] as Day[]).map(d=><TouchableOpacity key={d} onPress={()=>{setDay(d);setTab('train')}}>{card(<><Text style={s.heading}>{d}: {PLAN[d].title}</Text><Text style={s.muted}>{PLAN[d].ex.map(e=>e.name).join(' · ')}</Text></>)}</TouchableOpacity>)}
 {card(<><Text style={s.heading}>Recovery and nutrition</Text><Text style={s.muted}>Protein: 130–160 g daily · Aim for 8–9 hours of sleep · Begin near maintenance calories. Adjust for military workload.</Text></>)}</>}
 {tab==='progress'&&<>
 {card(<>
  <Text style={s.heading}>Export training log</Text>
  <Text style={s.muted}>Download or share one JSON file containing your completed workouts, logged weights and reps, body measurements, and current program. Send the file in ChatGPT for progress analysis.</Text>
  <Btn label="EXPORT / SAVE LOG (.JSON)" onPress={exportLog}/>
  <Text style={s.muted}>Choose a file-saving app or destination from your phone's share menu.</Text>
 </>)}
 {card(<><Text style={s.heading}>Workout history</Text><Text style={s.hero}>{data.done.length} sessions</Text><Text style={s.muted}>Target: 36 workouts across 12 weeks</Text>{data.done.slice().reverse().slice(0,15).map(k=><Text key={k} style={s.muted}>✓ {k}</Text>)}</>)}
 {card(<><Text style={s.heading}>Body measurements</Text><View style={s.days}>{['0','4','8','12'].map(k=><TouchableOpacity key={k} style={[s.day,check===k&&s.dayActive]} onPress={()=>setCheck(k)}><Text style={[s.dayText,check===k&&{color:bg}]}>W{k}</Text></TouchableOpacity>)}</View>
 {([['weight','Body weight (kg)'],['waist','Waist (cm)'],['arm','Flexed arm (cm)'],['chest','Chest (cm)'],['thigh','Thigh (cm)'],['pushups','Push-ups'],['pullups','Pull-ups']] as [keyof Measure,string][]).map(([key,title])=><View key={key} style={s.measureRow}><Text style={s.muted}>{title}</Text>{input(m[key],v=>measure(check,key,v),'Enter')}</View>)}</>)}
 {card(<><Text style={s.heading}>Week 0 → Week 12</Text>{(['weight','waist','arm','pushups','pullups'] as (keyof Measure)[]).map(k=>{const a=data.measures['0']?.[k],b=data.measures['12']?.[k];return <Text key={k} style={s.muted}>{k}: {a&&b?((Number(b)-Number(a)>0?'+':'')+(Number(b)-Number(a)).toFixed(1)):'Pending'}</Text>})}</>)}</>}
 {tab==='timer'&&<>{card(<><Text style={s.heading}>Rest timer</Text><Text style={s.clock}>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</Text><Btn label={running?'PAUSE':'START'} onPress={()=>setRunning(v=>!v)}/><View style={s.days}>{[60,90,120,180].map(n=><TouchableOpacity key={n} style={s.day} onPress={()=>{setRunning(false);setSeconds(n)}}><Text style={s.dayText}>{n}s</Text></TouchableOpacity>)}</View></>)}</>}
 <Text style={s.footer}>T.R.E.E.N. · Local storage · 12-week training experiment</Text></ScrollView></SafeAreaView>
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:bg},header:{padding:18,gap:5},kicker:{color:green,fontSize:10,fontWeight:'800',letterSpacing:1.4},logo:{color:'#F4F7F4',fontSize:31,fontWeight:'900',letterSpacing:3},muted:{color:muted,fontSize:13,lineHeight:20},nav:{flexDirection:'row',backgroundColor:panel,marginHorizontal:12,borderRadius:15,padding:4},navItem:{flex:1,paddingVertical:12,alignItems:'center'},navActive:{backgroundColor:'#1C3526',borderRadius:12},navText:{color:muted,fontWeight:'800',fontSize:10},content:{padding:14,gap:12,paddingBottom:55},card:{backgroundColor:panel,borderColor:'#2A4433',borderWidth:1,borderRadius:17,padding:15,gap:10},heading:{color:'#F4F7F4',fontSize:18,fontWeight:'800'},hero:{color:'#F4F7F4',fontSize:29,fontWeight:'900'},days:{flexDirection:'row',gap:8,flexWrap:'wrap'},day:{backgroundColor:'#1A3022',borderRadius:12,paddingHorizontal:14,paddingVertical:12,flexGrow:1,alignItems:'center'},dayActive:{backgroundColor:green},dayText:{color:'#F4F7F4',fontWeight:'800'},setRow:{flexDirection:'row',gap:8,alignItems:'center'},setLabel:{color:muted,width:48,fontWeight:'700'},input:{color:'#FFFFFF',backgroundColor:'#1B3325',borderColor:'#34533D',borderWidth:1,borderRadius:10,paddingHorizontal:12,paddingVertical:8,flex:1,minWidth:65,fontSize:15},btn:{backgroundColor:green,padding:14,borderRadius:13,alignItems:'center',flexGrow:1},subtle:{backgroundColor:'#1B3325',borderWidth:1,borderColor:'#34533D'},btnText:{color:bg,fontWeight:'900'},measureRow:{gap:6},label:{color:muted},clock:{color:'#F4F7F4',fontSize:64,textAlign:'center',fontWeight:'900'},footer:{color:muted,fontSize:10,textAlign:'center',marginTop:14},
 monthHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 monthArrow:{backgroundColor:'#1A3022',width:38,height:38,alignItems:'center',justifyContent:'center',borderRadius:11},
 monthArrowText:{color:green,fontSize:28,fontWeight:'700',lineHeight:32},
 calendarGrid:{flexDirection:'row',flexWrap:'wrap'},
 calendarWeekday:{width:'14.2857%',textAlign:'center',color:muted,fontSize:12,fontWeight:'800',paddingVertical:8},
 calendarCell:{width:'14.2857%',padding:2},
 calendarDate:{minHeight:52,alignItems:'center',justifyContent:'center',borderRadius:11,backgroundColor:'#192D21'},
 calendarToday:{borderWidth:1,borderColor:green},
 calendarSelected:{backgroundColor:green},
 calendarDateText:{fontSize:14,fontWeight:'800',color:'#F4F7F4'},
 calendarSelectedText:{color:bg},
 calendarDim:{opacity:0.35},
 calendarDot:{fontSize:10,color:green,minHeight:13},
 calendarExercise:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:7,borderBottomWidth:1,borderBottomColor:'#284232',gap:12},
 exerciseCalendarName:{flex:1,color:'#F4F7F4',fontSize:13,fontWeight:'700'},
 finishedText:{color:green,fontWeight:'800'}
});