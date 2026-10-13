import test from "node:test";
import assert from "node:assert/strict";
import {trialEligible} from "../src/utils/trialPolicy.js";
import {trialExpiry,reminderBucket} from "../src/utils/subscriptionAccess.js";
import {administratorEmail} from "../src/controllers/companyEmailController.js";

test("only unused, unpaid, active company registrations can start a free trial",()=>{
  const company={active:true,subscriptionPlan:"Own Plan"},registry={status:"ACTIVE"};
  assert.equal(trialEligible(company,registry,false),true);
  assert.equal(trialEligible(company,registry,true),false);
  assert.equal(trialEligible({...company,trialStartedAt:new Date()},registry,false),false);
  assert.equal(trialEligible(company,{...registry,trialStartedAt:new Date()},false),false);
  assert.equal(trialEligible({...company,subscriptionPlan:"Trial"},registry,false),false);
  assert.equal(trialEligible(company,{status:"ARCHIVED"},false),false);
  assert.equal(trialEligible({...company,active:false},registry,false),false);
});
test("14 day trial has bounded expiry and renewal reminders before and at expiry",()=>{
  const now=Date.UTC(2026,9,13),end=trialExpiry(now);
  assert.equal(end.getTime()-now,14*86400000);
  assert.equal(reminderBucket(end,now),null);
  assert.equal(reminderBucket(end,now+7*86400000),7);
  assert.equal(reminderBucket(end,now+11*86400000),3);
  assert.equal(reminderBucket(end,now+13*86400000),1);
  assert.equal(reminderBucket(end,end.getTime()),0);
});
test("admin email edits normalize and reject invalid or overlong addresses",()=>{
  assert.equal(administratorEmail("  OWNER@Example.com  "),"owner@example.com");
  for(const value of ["","bad","owner @example.com","<owner@example.com>","x".repeat(155)+"@test.com"])
    assert.throws(()=>administratorEmail(value),{statusCode:400});
});
