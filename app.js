const defaultAppointments = [
  {time:'09:00 AM',patient:'Sarah Mitchell',initials:'SM',color:'aqua',doctor:'Dr. Emily Carter',type:'Follow-up',status:'Confirmed'},
  {time:'10:30 AM',patient:'Michael Brown',initials:'MB',color:'orange',doctor:'Dr. Robert Adams',type:'Consultation',status:'Pending'},
  {time:'12:00 PM',patient:'Olivia Wilson',initials:'OW',color:'bluebg',doctor:'Dr. Sophia Williams',type:'Check-up',status:'Confirmed'},
  {time:'02:30 PM',patient:'James Anderson',initials:'JA',color:'rose',doctor:'Dr. Emily Carter',type:'Consultation',status:'Confirmed'}
];
let appointments = JSON.parse(localStorage.getItem('carely-appointments') || 'null') || defaultAppointments;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function renderAppointments(filter = '') {
  const visible = appointments.filter(a => `${a.patient} ${a.doctor} ${a.type}`.toLowerCase().includes(filter.toLowerCase()));
  $('#appointmentList').innerHTML = visible.slice(0,4).map(a => `<div class="appointment"><span class="time">${a.time}</span><div class="patient-avatar ${a.color}">${a.initials}</div><div class="appointment-info"><strong>${a.patient}</strong><small>${a.doctor} · ${a.type}</small></div><span class="tag ${a.status.toLowerCase()}">${a.status}</span></div>`).join('') || '<p class="subheading">No appointments found.</p>';
  $('#appointmentTable').innerHTML = visible.map(a => `<tr><td><strong>${a.patient}</strong></td><td>${a.doctor}</td><td>${a.time}, Sep 08</td><td>${a.type}</td><td><span class="tag ${a.status.toLowerCase()}">${a.status}</span></td></tr>`).join('') || '<tr><td colspan="5">No appointments found.</td></tr>';
}
renderAppointments();

function showSection(id) {
  $$('.section-view').forEach(s => s.classList.toggle('active', s.id === id));
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === id));
  $('#pageTitle').textContent = id.charAt(0).toUpperCase() + id.slice(1);
  $('#sidebar').classList.remove('open');
  window.scrollTo({top:0, behavior:'smooth'});
}
$$('[data-section]').forEach(btn => btn.addEventListener('click', () => showSection(btn.dataset.section)));
$('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

function openModal(){ $('#modal').classList.add('open'); $('#modal').querySelector('input').focus(); }
function closeModal(){ $('#modal').classList.remove('open'); }
$('#newAppointmentBtn').addEventListener('click', openModal);
$('#newAppointmentBtn2').addEventListener('click', openModal);
$('#modalClose').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if(e.target === $('#modal')) closeModal(); });

document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });
$('#appointmentForm').addEventListener('submit', e => {
  e.preventDefault();
  const form = new FormData(e.target); const patient = form.get('patient');
  const initials = patient.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  appointments.unshift({time:formatTime(form.get('time')), patient, initials, color:'aqua', doctor:form.get('doctor'), type:form.get('type'), status:'Confirmed'});
  localStorage.setItem('carely-appointments', JSON.stringify(appointments)); renderAppointments(); closeModal(); e.target.reset();
  $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 2800);
});
function formatTime(value){const [h,m]=value.split(':');const hour=Number(h);return `${hour%12||12}:${m} ${hour>=12?'PM':'AM'}`}
$('#appointmentSearch').addEventListener('input', e => renderAppointments(e.target.value));
$('#reviewBtn').addEventListener('click', () => { showSection('appointments'); $('#appointmentSearch').focus(); });
$$('.quick-prompts button').forEach(b => b.addEventListener('click', () => { $('#chatInput').value = b.textContent.replace(/[“”]/g,''); $('#chatInput').focus(); }));
function answerAssistant(){ const input=$('#chatInput'); const query=input.value.trim(); if(!query) return; const lower=query.toLowerCase(); let answer='I can help with appointments, availability, patient records, and clinic information.'; if(lower.includes('next')) answer=`The next appointment is ${appointments[0]?.patient || 'not available'} at ${appointments[0]?.time || 'no scheduled time'}.`; if(lower.includes('cancel')) answer='There are no cancellations recorded today. I can open the appointment list for a closer look.'; input.value=''; $('#toast').textContent=answer; $('#toast').classList.add('show'); setTimeout(()=>{$('#toast').classList.remove('show');$('#toast').textContent='Appointment created successfully'},3500); }
$('#chatBtn').addEventListener('click', answerAssistant); $('#chatInput').addEventListener('keydown', e=>{if(e.key==='Enter')answerAssistant()});
$('#learnBtn').addEventListener('click', () => { $('#toast').textContent='Carely AI is ready to assist your team.'; $('#toast').classList.add('show'); setTimeout(()=>{$('#toast').classList.remove('show');$('#toast').textContent='Appointment created successfully'},2500); });
